// Contrat des valeurs gardées dans $.state par le mod usage-panel.

/** Une fenêtre de quota telle que la session la rapporte. */
export type Limit = {
  /** `five_hour`, `seven_day` ou autre fenêtre renvoyée par l'engine. */
  kind: string;
  /** Pourcentage utilisé, de 0 à 100 (peut dépasser 100 pour un plafond de dépense). */
  percentUsed: number;
  /** Date de réinitialisation, en ISO 8601. */
  resetsAt?: string;
};

/** Instantané lu à chaque rafraîchissement du panneau. */
export type Snapshot = {
  /** Horodatage de la lecture, en millisecondes. */
  now: number;
  /** Compte connecté (absent si le fichier de configuration n'est pas lisible). */
  email: string | null;
  organization: string | null;
  /** Vrai quand l'engine rapporte des fenêtres de quota (abonnement). */
  isSubscription: boolean;
  limits: Limit[];
  /** Taille du contexte occupé, en pourcentage de la fenêtre du modèle. */
  contextPercent: number | null;
  contextTokens: number | null;
  contextWindow: number;
  costUsd: number | null;
};

declare module 'claude-code' {
  interface PluginState {
    'usage-panel': { snapshot: Snapshot | null };
  }
}
