// Tournoi Baby-foot CanalCup — configuration (V1 statique, on édite ce fichier).
//
// L'état MUTABLE d'une ÉDITION (statut, inscriptions ouvertes/fermées, format,
// nb de tables, dates cérémonial) vit en base dans babyfoot_tournaments (piloté
// par l'admin). Ici : les valeurs STATIQUES — créneaux, barème des points,
// scores cibles par défaut, projection, helpers. Heure NC (UTC+11).

export type BabyfootStage =
  | "participation" // a joué, sorti en poules / 1er tour
  | "qualified" // sorti des poules (ou atteint les quarts en élim. directe)
  | "semifinalist" // demi-finaliste
  | "finalist" // finaliste (perdant de la finale)
  | "champion"; // vainqueur

export interface BabyfootSlot {
  key: string; // stocké dans babyfoot_entry_availability.slot_key
  label: string; // affiché à l'inscription et dans la matrice admin
}

export const BABYFOOT = {
  // Édition en cours (année) — l'historique s'empile par season en base.
  currentSeason: 2026,
  // Date officielle du tournoi.
  eventDate: "2026-07-16",
  eventLabel: "jeudi 16 juillet",
  // Journée amicale / entraînement (chauffe avant l'officiel). À ajuster.
  friendlyDate: "2026-07-14",
  friendlyLabel: "mardi 14 juillet",

  // Créneaux : demi-journées simples (le binôme coche ses disponibilités).
  slots: [
    { key: "am", label: "Matin" },
    { key: "noon", label: "Midi" },
    { key: "pm", label: "Après-midi" },
  ] as BabyfootSlot[],

  // Barème VALEUR FACIALE, 5 PALIERS lisibles. Un binôme reçoit UN palier = son
  // RÉSULTAT (pas de cumul par match). Crédité tel quel au classement individuel
  // ET équipe (sans pondération). Champion = 65 (cap voulu). Tout le monde comprend.
  bareme: {
    participation: 5,
    qualified: 15, // sorti des poules
    semifinalist: 30,
    finalist: 45,
    champion: 65,
  } as Record<BabyfootStage, number>,

  // Libellés (registre babyfoot_awards.label + affichage). En élimination directe,
  // "qualified" = "Quart de finaliste" (adapté à l'affichage selon le format).
  stageLabel: {
    participation: "Participation",
    qualified: "Sorti des poules",
    semifinalist: "Demi-finaliste",
    finalist: "Finaliste",
    champion: "Champion 🏆",
  } as Record<BabyfootStage, string>,

  // Scores cibles par défaut (l'admin peut surcharger par édition en base).
  scoreTargets: { pool: 5, ko: 7, final: 10 },

  // Projection de durée.
  tablesDefault: 2,
  avgMatchMinutes: 9, // match court 5-7 min + rotation ≈ 8-10 min
};

// Ordre des paliers (du plus faible au plus fort) — pour comparer un résultat.
export const BABYFOOT_STAGE_ORDER: BabyfootStage[] = [
  "participation",
  "qualified",
  "semifinalist",
  "finalist",
  "champion",
];

export function eventDateMs(): number {
  return new Date(`${BABYFOOT.eventDate}T00:00:00+11:00`).getTime();
}
