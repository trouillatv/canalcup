// Tournoi Baby-foot CanalCup — configuration (V2, format "mini-championnat").
//
// FORMAT : Phase 1 = mini-championnat, chaque binôme joue EXACTEMENT 3 matchs
// (adversaires tirés au sort, jamais deux fois le même). Classement (victoires
// → diff → BP → confrontation directe → tirage). Les 4 premiers → Phase 2
// (demies 1v4 / 2v3, petite finale, finale). Matchs AU TEMPS (5 min + but en or).
//
// Barème VALEUR FACIALE, cumulatif, max 65 (valorise d'aller loin) :
//   Participation 5 · chaque victoire de phase 1 +5 (max 15) · Qualif demi 10
//   · Victoire de demi 15 · Champion 20.

export type BabyfootStage = "participation" | "phase1" | "qualified" | "semi_win" | "champion";

export interface BabyfootSlot {
  key: string; // stocké dans babyfoot_entry_availability.slot_key
  label: string;
}

export const BABYFOOT = {
  currentSeason: 2026,

  // Événement sur 2 jours (finales le vendredi).
  eventLabel: "jeudi 16 & vendredi 17 juillet",
  days: {
    thu: { date: "2026-07-16", label: "Jeudi 16 juillet" },
    fri: { date: "2026-07-17", label: "Vendredi 17 juillet" },
  },
  finalsDay: "fri" as const, // les finales ont toujours lieu le vendredi

  // Fermeture des inscriptions + tirage au sort officiel (événement TV).
  inscriptionsCloseAt: "2026-07-10T12:00:00+11:00",
  inscriptionsCloseLabel: "vendredi 10 juillet à 12h00",
  drawAt: "2026-07-10T13:30:00+11:00",
  drawLabel: "vendredi 10 juillet à 13h30",

  // Créneaux : 2 choix simples (on peut cocher un ou les deux).
  slots: [
    { key: "thu", label: "Jeudi 16 (11h–14h)" },
    { key: "fri", label: "Vendredi 17 (11h–14h)" },
  ] as BabyfootSlot[],

  // Planning : fenêtre de jeu et durée d'un créneau de match.
  dayStart: "11:00",
  dayEnd: "14:00",
  matchMinutes: 5, // temps réglementaire (puis but en or si égalité)
  rotationMinutes: 3, // battement entre 2 matchs sur une même table
  tablesDefault: 2,

  // Nb de matchs garantis par binôme en phase 1.
  matchesPerTeam: 3,
  // Nb de qualifiés pour la phase finale.
  qualifiers: 4,

  // Barème cumulatif (points faciaux). Max 65.
  bareme: {
    participation: 5,
    matchWin: 5, // par victoire de phase 1 (max 3 → 15)
    qualified: 10, // top 4 (qualif demi)
    semiWin: 15, // victoire de demi-finale
    champion: 20,
  },

  // Libellés des lignes de registre (babyfoot_awards.label).
  stageLabel: {
    participation: "Participation",
    phase1: "Victoires de poule",
    qualified: "Qualifié en demi-finale",
    semi_win: "Vainqueur de demi-finale",
    champion: "Champion 🏆",
  } as Record<BabyfootStage, string>,
};

// Points d'un parcours "champion parfait" (contrôle du cap = 65).
export function championMaxPoints(): number {
  const b = BABYFOOT.bareme;
  return b.participation + b.matchWin * BABYFOOT.matchesPerTeam + b.qualified + b.semiWin + b.champion;
}
