# usage-panel

Mod pour Claude Code : un panneau « Usage » affichant le compte, les quotas 5 h et hebdomadaires (avec délai avant réinitialisation, couleurs selon le niveau) et la taille du contexte de la session.

Il s'ouvre au lancement de la session. On peut le fermer et le rouvrir avec la commande `/usage-panel`.

## Installation

```
/plugin marketplace add <propriétaire>/usage-panel
/plugin install usage-panel@usage-panel
```

Le compte est lu dans `~/.claude.json` (champ `oauthAccount`), qui n'est pas une interface officielle : si le format change, la ligne compte affiche « compte inconnu ».
