import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Snapshot } from '../types'

const PANE = 'usage-panel'
const REFRESH_MS = 60_000
const snapshot = atom({ plugin: 'usage-panel', key: 'snapshot' } as const, null)

/** Couleur selon le niveau d'utilisation : vert, orange puis rouge. */
const tone = (percent: number) =>
  percent >= 90 ? 'error' : percent >= 70 ? 'warning' : 'success'

/** Barre de progression en blocs, sur 20 cases. */
const bar = (percent: number) => {
  const filled = Math.min(20, Math.max(0, Math.round((percent / 100) * 20)))
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
}

/** Délai restant avant la réinitialisation, en français. */
const untilReset = (resetsAt: string | undefined, now: number) => {
  if (!resetsAt) return 'inconnu'
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - now) / 60_000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  if (days > 0) return `${days} j ${hours} h`
  if (hours > 0) return `${hours} h ${rest} min`
  return `${rest} min`
}

const LABELS: Record<string, string> = {
  five_hour: 'Fenêtre 5 h',
  seven_day: 'Semaine',
}

/** Lit le compte dans ~/.claude.json ; sans succès, le compte reste inconnu. */
const readAccount = async ($: EngineInterface) => {
  try {
    const home = await $.env.get('HOME')
    if (!home) return { email: null, organization: null }
    const raw = await $.fs.read(`${home}/.claude.json`)
    const account = JSON.parse(raw).oauthAccount ?? {}
    return {
      email: (account.emailAddress as string | undefined) ?? null,
      organization: (account.organizationName as string | undefined) ?? null,
    }
  } catch {
    return { email: null, organization: null }
  }
}

/** Relit l'usage et le compte, puis publie l'instantané. */
const refresh = async ($: EngineInterface) => {
  const usage = await $.session.usage()
  const account = await readAccount($)
  const limits: Limit[] = usage.rateLimits.map(one => ({
    kind: one.kind,
    percentUsed: one.percentUsed,
    resetsAt: one.resetsAt,
  }))
  const next: Snapshot = {
    now: await $.clock.now(),
    email: account.email,
    organization: account.organization,
    isSubscription: limits.length > 0,
    limits,
    contextPercent: usage.context.percent ?? null,
    contextTokens: usage.context.tokens ?? null,
    contextWindow: usage.context.window,
    costUsd: usage.cost?.usd ?? null,
  }
  await update($, snapshot, () => next)
}

export const register: Register = on => {
  // Le timer se réarme à chaque passage : le délai de réinitialisation se recalcule chaque minute.
  let engine: EngineInterface | undefined

  const schedule = () => {
    if (!engine) return
    const $ = engine
    $.clock.after(REFRESH_MS, () => {
      void refresh($).then(schedule)
    })
  }

  on('session.start', async ($, e, next) => {
    engine = $
    await $.command.register({
      name: 'usage-panel',
      description: 'Affiche le compte, les quotas et la taille du contexte',
    })
    await refresh($)
    schedule()
    // Ouverture automatique : la personne peut le fermer, et le rouvrir avec la commande.
    void $.ui.open({ id: PANE, title: 'Usage' })

    return next(e)
  })

  on('command.run', { command: 'usage-panel' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: 'Usage' })

    return { text: 'Panneau usage ouvert.' }
  })

  // Rafraîchi à chaque mesure poussée par l'engine (fin de tour, fenêtre qui bouge).
  on('session.measure', async ($, e, next) => {
    await refresh($)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s = await read($, snapshot)

    if (s === null) {
      return <Text dimColor>Lecture de l'usage en cours…</Text>
    }

    return (
      <Box flexDirection="column">
        <Text bold>Compte</Text>
        <Text>
          {s.email ?? 'compte inconnu'}
          {s.organization ? ` · ${s.organization}` : ''}
        </Text>
        <Text dimColor>
          {s.isSubscription ? 'Abonnement' : 'Sans abonnement (pas de quota affiché)'}
        </Text>

        <Text> </Text>
        <Text bold>Quotas</Text>
        {s.limits.length === 0 && <Text dimColor>Aucune fenêtre de quota rapportée.</Text>}
        {s.limits.map(limit => (
          <Box key={limit.kind} flexDirection="column">
            <Text color={tone(limit.percentUsed)}>
              {LABELS[limit.kind] ?? limit.kind} {bar(limit.percentUsed)}{' '}
              {limit.percentUsed.toFixed(0)} %
            </Text>
            <Text dimColor>
              Réinitialisation dans {untilReset(limit.resetsAt, s.now)}
            </Text>
          </Box>
        ))}

        <Text> </Text>
        <Text bold>Contexte de la session</Text>
        {s.contextPercent === null ? (
          <Text dimColor>
            Pas encore de réponse dans cette fenêtre (fenêtre {s.contextWindow} tokens).
          </Text>
        ) : (
          <Text color={tone(s.contextPercent)}>
            {bar(s.contextPercent)} {s.contextPercent} % · {s.contextTokens} /{' '}
            {s.contextWindow} tokens
          </Text>
        )}

        {s.costUsd !== null && (
          <>
            <Text> </Text>
            <Text dimColor>Coût de la session : {s.costUsd.toFixed(2)} $</Text>
          </>
        )}
      </Box>
    )
  })
}
