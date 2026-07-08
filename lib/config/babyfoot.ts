// Tournoi Baby-foot CanalCup — configuration (V2, championnat, UNE table).
//
// FORMAT : Phase 1 = mini-championnat (chaque binôme joue 3 matchs), classement
// unique, Top 4 → demies 1v4/2v3, petite finale, finale. Matchs AU TEMPS (5 min
// + but en or). Barème cumulatif max 65.
//
// UNE SEULE TABLE → disponibilités par CRÉNEAUX DE 30 MIN (jeu 11-14h, ven 11-14h
// = 12 créneaux). Un créneau accueille au plus 3 matchs (1 table). Un binôme
// doit cocher au moins 3 créneaux ; un créneau se ferme à l'inscription au-delà
// de 8 binômes (souplesse pour le tirage).

export type BabyfootStage = "participation" | "phase1" | "qualified" | "semi_win" | "champion";

export interface BabyfootSlot {
  key: string; // stocké dans babyfoot_entry_availability.slot_key
  day: "thu" | "fri";
  start: string; // "11:00"
  label: string; // "Jeu 11h00–11h30"
}

const DAY_LABEL = { thu: "Jeu", fri: "Ven" } as const;
// Jeudi : championnat toute la matinée + début d'aprèm. Vendredi : seulement le
// matin pour le championnat ; les créneaux 12h30–14h00 sont RÉSERVÉS aux phases
// finales (demies / petite finale / finale) et ne sont pas proposés à l'inscription.
const SLOT_TIMES_BY_DAY: Record<"thu" | "fri", string[]> = {
  thu: ["11:00", "11:30", "12:00", "12:30", "13:00", "13:30"],
  fri: ["11:00", "11:30", "12:00"],
};

function buildSlots(): BabyfootSlot[] {
  const out: BabyfootSlot[] = [];
  for (const day of ["thu", "fri"] as const) {
    for (const start of SLOT_TIMES_BY_DAY[day]) {
      const [h, m] = start.split(":");
      const end = m === "00" ? `${h}h30` : `${Number(h) + 1}h00`;
      out.push({ key: `${day}_${h}${m}`, day, start, label: `${DAY_LABEL[day]} ${h}h${m}–${end}` });
    }
  }
  return out;
}

export const BABYFOOT = {
  currentSeason: 2026,
  eventLabel: "jeudi 16 & vendredi 17 juillet",
  days: {
    thu: { date: "2026-07-16", label: "Jeudi 16 juillet" },
    fri: { date: "2026-07-17", label: "Vendredi 17 juillet" },
  },
  finalsDay: "fri" as const,

  inscriptionsCloseAt: "2026-07-10T12:00:00+11:00",
  inscriptionsCloseLabel: "vendredi 10 juillet à 12h00",
  drawAt: "2026-07-10T13:30:00+11:00",
  drawLabel: "vendredi 10 juillet à 13h30",

  // 12 créneaux de 30 min.
  slots: buildSlots(),
  minSlots: 3, // un binôme coche au moins 3 créneaux
  recommendedSlots: 5,
  slotRegistrationCap: 8, // un créneau se ferme à l'inscription au-delà de 8 binômes
  matchesPerSlot: 3, // capacité planning : 3 matchs / créneau (1 table)

  tablesDefault: 1, // UNE table
  matchMinutes: 5, // temps réglementaire (puis but en or)
  rotationMinutes: 3,

  matchesPerTeam: 3,
  qualifiers: 4,

  bareme: {
    participation: 5,
    matchWin: 5, // par victoire de championnat (max 3 → 15)
    qualified: 10, // top 4
    semiWin: 15,
    champion: 20,
  },

  stageLabel: {
    participation: "Participation",
    phase1: "Victoires de championnat",
    qualified: "Qualifié en demi-finale",
    semi_win: "Vainqueur de demi-finale",
    champion: "Champion 🏆",
  } as Record<BabyfootStage, string>,
};

/** Datetime ISO de début d'un créneau (fuseau NC +11:00). */
export function slotStartISO(slotKey: string): string | null {
  const s = BABYFOOT.slots.find((x) => x.key === slotKey);
  if (!s) return null;
  return `${BABYFOOT.days[s.day].date}T${s.start}:00+11:00`;
}

export function championMaxPoints(): number {
  const b = BABYFOOT.bareme;
  return b.participation + b.matchWin * BABYFOOT.matchesPerTeam + b.qualified + b.semiWin + b.champion;
}
