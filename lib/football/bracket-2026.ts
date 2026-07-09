// ─────────────────────────────────────────────────────────────────────────────
//  TABLEAU À ÉLIMINATION DIRECTE — COUPE DU MONDE 2026 (matrice officielle FIFA)
// ─────────────────────────────────────────────────────────────────────────────
//
//  48 équipes → 12 poules de 4 → 32 qualifiés (12 1ers + 12 2es + 8 meilleurs
//  3es) → Seizièmes (32) → Huitièmes (16) → Quarts → Demis → Finale.
//
//  Les emplacements 1er/2e sont FIXES. Les 8 emplacements « meilleur 3e » sont
//  contraints à un ensemble de poules (FIFA a 495 combinaisons pré-définies) :
//  on respecte ces ensembles via une affectation valide (suffisant pour une
//  PROJECTION ; FIFA fige la combinaison exacte à la fin des poules).
//
//  Source : matrice officielle FIFA / Wikipédia « 2026 FIFA World Cup knockout
//  stage » (matchs 73→104). 0 API, 0 IA, 0 base : pure donnée statique.
// ─────────────────────────────────────────────────────────────────────────────

export type Slot =
  | { kind: "winner"; group: string }
  | { kind: "runner"; group: string }
  | { kind: "third"; groups: string[] }
  | { kind: "winnerOf"; feeder: number }; // vainqueur d'un match amont (n° FIFA)

export interface BracketMatch {
  code: string; // S1..S16, H1..H8, Q1..Q4, D1/D2, F
  fifaNo: number; // 73..104
  round: RoundKey;
  a: Slot;
  b: Slot;
}

export type RoundKey = "Seizièmes" | "Huitièmes" | "Quarts" | "Demis" | "Finale";

// Helpers de construction
const W = (group: string): Slot => ({ kind: "winner", group });
const RU = (group: string): Slot => ({ kind: "runner", group });
const T = (...groups: string[]): Slot => ({ kind: "third", groups });
const WOf = (feeder: number): Slot => ({ kind: "winnerOf", feeder });

// ── Seizièmes (Round of 32, matchs 73-88) ────────────────────────────────────
// ORDRE = ordre de l'ARBRE (haut→bas) pour que les connecteurs visuels soient
// fidèles : chaque paire (i, i+1) alimente le match i des Huitièmes.
const SEIZIEMES: Array<{ no: number; a: Slot; b: Slot }> = [
  { no: 74, a: W("E"), b: T("A", "B", "C", "D", "F") },
  { no: 77, a: W("I"), b: T("C", "D", "F", "G", "H") },
  { no: 73, a: RU("A"), b: RU("B") },
  { no: 75, a: W("F"), b: RU("C") },
  { no: 83, a: RU("K"), b: RU("L") },
  { no: 84, a: W("H"), b: RU("J") },
  { no: 81, a: W("D"), b: T("B", "E", "F", "I", "J") },
  { no: 82, a: W("G"), b: T("A", "E", "H", "I", "J") },
  { no: 76, a: W("C"), b: RU("F") },
  { no: 78, a: RU("E"), b: RU("I") },
  { no: 79, a: W("A"), b: T("C", "E", "F", "H", "I") },
  { no: 80, a: W("L"), b: T("E", "H", "I", "J", "K") },
  { no: 86, a: W("J"), b: RU("H") },
  { no: 88, a: RU("D"), b: RU("G") },
  { no: 85, a: W("B"), b: T("E", "F", "G", "I", "J") },
  { no: 87, a: W("K"), b: T("D", "E", "I", "J", "L") },
];

// ── Huitièmes (Round of 16, 89-96) — ordre arbre ─────────────────────────────
const HUITIEMES: Array<{ no: number; a: number; b: number }> = [
  { no: 89, a: 74, b: 77 },
  { no: 90, a: 73, b: 75 },
  { no: 93, a: 83, b: 84 },
  { no: 94, a: 81, b: 82 },
  { no: 91, a: 76, b: 78 },
  { no: 92, a: 79, b: 80 },
  { no: 95, a: 86, b: 88 },
  { no: 96, a: 85, b: 87 },
];

// ── Quarts (97-100) ──────────────────────────────────────────────────────────
const QUARTS: Array<{ no: number; a: number; b: number }> = [
  { no: 97, a: 89, b: 90 },
  { no: 98, a: 93, b: 94 },
  { no: 99, a: 91, b: 92 },
  { no: 100, a: 95, b: 96 },
];

// ── Demis (101-102) ──────────────────────────────────────────────────────────
const DEMIS: Array<{ no: number; a: number; b: number }> = [
  { no: 101, a: 97, b: 98 },
  { no: 102, a: 99, b: 100 },
];

// ── Finale (104) ─────────────────────────────────────────────────────────────
const FINALE = { no: 104, a: 101, b: 102 };

// Codes lisibles (S1..S16 dans l'ordre arbre, etc.)
const codeFor = new Map<number, string>();
SEIZIEMES.forEach((m, i) => codeFor.set(m.no, `S${i + 1}`));
HUITIEMES.forEach((m, i) => codeFor.set(m.no, `H${i + 1}`));
QUARTS.forEach((m, i) => codeFor.set(m.no, `Q${i + 1}`));
DEMIS.forEach((m, i) => codeFor.set(m.no, `D${i + 1}`));
codeFor.set(FINALE.no, "F");

export function bracketCode(fifaNo: number): string {
  return codeFor.get(fifaNo) ?? `M${fifaNo}`;
}

// Arbre ordonné (Seizièmes → Finale)
export const BRACKET_TREE: Array<{ round: RoundKey; matches: BracketMatch[] }> = [
  {
    round: "Seizièmes",
    matches: SEIZIEMES.map((m) => ({ code: codeFor.get(m.no)!, fifaNo: m.no, round: "Seizièmes" as const, a: m.a, b: m.b })),
  },
  {
    round: "Huitièmes",
    matches: HUITIEMES.map((m) => ({ code: codeFor.get(m.no)!, fifaNo: m.no, round: "Huitièmes" as const, a: WOf(m.a), b: WOf(m.b) })),
  },
  {
    round: "Quarts",
    matches: QUARTS.map((m) => ({ code: codeFor.get(m.no)!, fifaNo: m.no, round: "Quarts" as const, a: WOf(m.a), b: WOf(m.b) })),
  },
  {
    round: "Demis",
    matches: DEMIS.map((m) => ({ code: codeFor.get(m.no)!, fifaNo: m.no, round: "Demis" as const, a: WOf(m.a), b: WOf(m.b) })),
  },
  {
    round: "Finale",
    matches: [{ code: "F", fifaNo: FINALE.no, round: "Finale" as const, a: WOf(FINALE.a), b: WOf(FINALE.b) }],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  RÉSOLUTION / PROJECTION depuis les classements de poule
// ─────────────────────────────────────────────────────────────────────────────

export interface StandingLike {
  team_name_fr: string;
  team_flag?: string;
  played: number;
  goal_diff: number;
  goals_for: number;
  points: number;
}

/** Vrai match KO (base) — sert à propager les qualifiés dans les tours suivants. */
export interface RealKoMatch {
  team_a: string;
  team_b: string;
  flag_a?: string | null;
  flag_b?: string | null;
  score_a?: number | null;
  score_b?: number | null;
  /** Tirs au but — départage un KO nul après prolongation. */
  pen_a?: number | null;
  pen_b?: number | null;
  status: string;
  phase?: string | null;
}

// Normalise un nom d'équipe pour rapprocher standings (FR) et matchs (FR).
function normName(n: string): string {
  return (n ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export interface ResolvedSlot {
  /** Équipe résolue (projection / réel confirmé), sinon undefined. */
  teamName?: string;
  teamFlag?: string;
  /** Sous-libellé : « 1er Gr. A », « 3e Gr. C (repêché) », « Vainqueur S1 »… */
  sub: string;
  /** Libellé d'emplacement quand l'équipe n'est pas affichée (« 1er Groupe A »). */
  label: string;
  /** true si la position est mathématiquement actée (poule terminée). */
  confirmed: boolean;
}

export interface ResolvedMatch {
  code: string;
  fifaNo: number;
  a: ResolvedSlot;
  b: ResolvedSlot;
}

export interface ResolvedRound {
  round: RoundKey;
  matches: ResolvedMatch[];
}

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function sortGroup(rows: StandingLike[]): StandingLike[] {
  return [...rows].sort(
    (x, y) => y.points - x.points || y.goal_diff - x.goal_diff || y.goals_for - x.goals_for
  );
}

// Affectation des 8 meilleurs 3es aux 8 emplacements contraints (backtracking).
// `slots` = liste ordonnée {no, allowed[]} ; `groups` = lettres des 3es qualifiés.
function assignThirds(
  groups: string[],
  slots: Array<{ no: number; allowed: string[] }>
): Record<number, string> {
  const result: Record<number, string> = {};
  const used = new Set<string>();
  const solve = (i: number): boolean => {
    if (i === slots.length) return true;
    const slot = slots[i];
    for (const g of groups) {
      if (used.has(g) || !slot.allowed.includes(g)) continue;
      used.add(g);
      result[slot.no] = g;
      if (solve(i + 1)) return true;
      used.delete(g);
      delete result[slot.no];
    }
    return false;
  };
  solve(0);
  return result;
}

/**
 * Résout tout le tableau depuis les classements de poule.
 * @param standings  Record clé « Groupe X » → lignes de classement.
 * @param mode  "projection" = affiche les positions provisoires ;
 *              "reel" = n'affiche que les positions actées (poule terminée).
 */
export function resolveKnockout(
  standings: Record<string, StandingLike[]>,
  mode: "projection" | "reel",
  realMatches: RealKoMatch[] = []
): ResolvedRound[] {
  // Classement trié par poule
  const perGroup: Record<string, StandingLike[]> = {};
  const groupComplete: Record<string, boolean> = {};
  let groupsWithData = 0;
  for (const L of LETTERS) {
    const rows = standings[`Groupe ${L}`] ?? [];
    const sorted = sortGroup(rows);
    perGroup[L] = sorted;
    groupComplete[L] = sorted.length === 4 && sorted.every((r) => (r.played ?? 0) >= 3);
    if (sorted.some((r) => (r.played ?? 0) > 0)) groupsWithData++;
  }
  const allComplete = LETTERS.every((L) => groupComplete[L]);
  const anyData = groupsWithData > 0;

  // Classement des 12 troisièmes → 8 meilleurs
  const thirds = LETTERS.map((L) => ({ L, row: perGroup[L][2] })).filter((t) => t.row);
  const thirdsRanked = [...thirds].sort(
    (x, y) =>
      y.row.points - x.row.points ||
      y.row.goal_diff - x.row.goal_diff ||
      y.row.goals_for - x.row.goals_for ||
      x.L.localeCompare(y.L)
  );
  const qualifiedThirdGroups = thirdsRanked.slice(0, 8).map((t) => t.L);

  // Emplacements « 3e » contraints (matchs 74,77,79,80,81,82,85,87)
  const thirdSlots = SEIZIEMES.filter((m) => m.b.kind === "third").map((m) => ({
    no: m.no,
    allowed: (m.b as { groups: string[] }).groups,
  }));
  const thirdAssignment = assignThirds(qualifiedThirdGroups, thirdSlots);

  // ── Propagation des qualifiés : winnerOf(feeder) → vrai vainqueur dès qu'un
  // match amont est joué, À TOUS LES TOURS (16e → 8e → quart → demi → finale).
  // On rattache chaque vrai match à sa position d'arbre via l'IDENTITÉ
  // DÉTERMINISTE de ses équipes : chaque qualifié (1er/2e de poule, ou 3e
  // repêché affecté) a un n° de 16e FIXE, donc un chemin fixe dans l'arbre. Le
  // vainqueur = le score FINAL (prolongation/TAB inclus), car c'est lui qui se
  // QUALIFIE — à ne pas confondre avec le score réglementaire (qui juge les pronos).
  const winnerByFeeder: Record<number, { teamName: string; teamFlag?: string }> = {};

  // n° de 16e de chaque équipe qualifiée (déterministe depuis les poules).
  const seizeNoOfTeam: Record<string, number> = {};
  for (const m of SEIZIEMES) {
    const detOf = (s: Slot): StandingLike | undefined =>
      s.kind === "winner" ? perGroup[s.group]?.[0] : s.kind === "runner" ? perGroup[s.group]?.[1] : undefined;
    const a = detOf(m.a), b = detOf(m.b);
    if (a?.team_name_fr) seizeNoOfTeam[normName(a.team_name_fr)] = m.no;
    if (b?.team_name_fr) seizeNoOfTeam[normName(b.team_name_fr)] = m.no;
  }
  for (const [noStr, groupL] of Object.entries(thirdAssignment)) {
    const row = perGroup[groupL]?.[2];
    if (row?.team_name_fr) seizeNoOfTeam[normName(row.team_name_fr)] = Number(noStr);
  }

  // Chaînage amont→aval : n° d'un match → n° du match qui accueille son vainqueur.
  const nextMatchOf: Record<number, number> = {};
  for (const m of [...HUITIEMES, ...QUARTS, ...DEMIS, FINALE]) {
    nextMatchOf[m.a] = m.no;
    nextMatchOf[m.b] = m.no;
  }
  const ROUND_STEPS: Record<string, number> = { Seizièmes: 0, Huitièmes: 1, Quarts: 2, Demis: 3, Finale: 4 };
  // n° de match d'une équipe à un tour donné : on part de son 16e et on remonte.
  const fifaNoAtRound = (teamNorm: string, round: string): number | null => {
    let no: number | undefined = seizeNoOfTeam[teamNorm];
    if (no == null) return null;
    const steps = ROUND_STEPS[round];
    if (steps == null) return null;
    for (let i = 0; i < steps; i++) {
      no = nextMatchOf[no];
      if (no == null) return null;
    }
    return no;
  };

  for (const rm of realMatches) {
    const round = rm.phase ?? "";
    if (!(round in ROUND_STEPS) || rm.status !== "finished") continue;
    if (rm.score_a == null || rm.score_b == null) continue;
    // Vainqueur = meilleur score final (prolongation incluse), ou, à égalité,
    // meilleur total aux tirs au but. Sans t.a.b. connus → indécidable, on saute.
    let winsA: boolean;
    if (rm.score_a !== rm.score_b) {
      winsA = rm.score_a > rm.score_b;
    } else if (rm.pen_a != null && rm.pen_b != null && rm.pen_a !== rm.pen_b) {
      winsA = rm.pen_a > rm.pen_b;
    } else {
      continue;
    }
    const no = fifaNoAtRound(normName(rm.team_a), round) ?? fifaNoAtRound(normName(rm.team_b), round);
    if (no == null) continue;
    winnerByFeeder[no] = winsA
      ? { teamName: rm.team_a, teamFlag: rm.flag_a ?? undefined }
      : { teamName: rm.team_b, teamFlag: rm.flag_b ?? undefined };
  }

  const showTeams = mode === "projection" ? anyData : false; // réel : rien tant que rien d'acté

  const resolveSlot = (slot: Slot, fifaNo: number): ResolvedSlot => {
    if (slot.kind === "winnerOf") {
      const code = bracketCode(slot.feeder);
      const w = winnerByFeeder[slot.feeder];
      if (w) {
        return { teamName: w.teamName, teamFlag: w.teamFlag, sub: `Vainqueur ${code} (qualifié)`, label: `Vainqueur ${code}`, confirmed: true };
      }
      return { sub: `Vainqueur ${code}`, label: `Vainqueur ${code}`, confirmed: false };
    }
    if (slot.kind === "winner" || slot.kind === "runner") {
      const idx = slot.kind === "winner" ? 0 : 1;
      const pos = slot.kind === "winner" ? "1er" : "2e";
      const label = `${pos} Groupe ${slot.group}`;
      const row = perGroup[slot.group]?.[idx];
      const confirmed = groupComplete[slot.group];
      const display = mode === "reel" ? confirmed : showTeams;
      if (display && row) {
        return { teamName: row.team_name_fr, teamFlag: row.team_flag, sub: `${pos} Gr. ${slot.group}`, label, confirmed };
      }
      return { sub: label, label, confirmed };
    }
    // third — emplacement contraint résolu par le n° FIFA du match.
    const label = `3e ${slot.groups.join("·")}`;
    const groupL = thirdAssignment[fifaNo];
    const row = groupL ? perGroup[groupL]?.[2] : undefined;
    const confirmed = allComplete;
    const display = mode === "reel" ? confirmed : showTeams;
    if (display && row && groupL) {
      return { teamName: row.team_name_fr, teamFlag: row.team_flag, sub: `3e Gr. ${groupL} (repêché)`, label, confirmed };
    }
    return { sub: label, label, confirmed };
  };

  return BRACKET_TREE.map((r) => ({
    round: r.round,
    matches: r.matches.map((m) => ({ code: m.code, fifaNo: m.fifaNo, a: resolveSlot(m.a, m.fifaNo), b: resolveSlot(m.b, m.fifaNo) })),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
//  CALENDRIER des phases finales (projection au calendrier des matchs)
// ─────────────────────────────────────────────────────────────────────────────
//
//  Dates/heures par n° FIFA (Huitièmes → Finale), heure Nouvelle-Calédonie (+11).
//  ⚠️ À VÉRIFIER avant prod (échelle officielle WC2026 ; affectation jour/heure
//  par match = projection). Sert à afficher les matchs FUTURS au calendrier avec
//  leur date AVANT que les vraies lignes n'arrivent (équipes pré-remplies dès
//  qu'elles sont connues via resolveKnockout).

export const KNOCKOUT_SCHEDULE: Record<number, string> = {
  // Huitièmes (89-96)
  89: "2026-07-07T06:00:00+11:00", 90: "2026-07-07T13:00:00+11:00",
  91: "2026-07-08T06:00:00+11:00", 92: "2026-07-08T13:00:00+11:00",
  93: "2026-07-09T06:00:00+11:00", 94: "2026-07-09T13:00:00+11:00",
  95: "2026-07-10T06:00:00+11:00", 96: "2026-07-10T13:00:00+11:00",
  // Quarts (97-100)
  97: "2026-07-11T06:00:00+11:00", 98: "2026-07-11T13:00:00+11:00",
  99: "2026-07-12T13:00:00+11:00", 100: "2026-07-13T13:00:00+11:00",
  // Demis (101-102)
  101: "2026-07-16T11:00:00+11:00", 102: "2026-07-17T11:00:00+11:00",
  // Finale (104)
  104: "2026-07-20T09:00:00+11:00",
};

export interface ProjectedCalMatch {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  starts_at: string;
  phase: string;
  status: string;
  projected: true;
}

// Matchs FUTURS à élimination directe, pour le calendrier : un par match de
// Huitièmes → Finale dont le TOUR n'a pas encore de vraie ligne en base. Équipes
// pré-remplies si déjà connues (sinon « Vainqueur S1 » / « 1er Gr. E »).
export function projectedKnockoutCalendar(
  standings: Record<string, StandingLike[]>,
  realKo: RealKoMatch[],
  realPhases: Set<string>
): ProjectedCalMatch[] {
  const rounds = resolveKnockout(standings, "projection", realKo);
  const out: ProjectedCalMatch[] = [];
  for (const r of rounds) {
    if (r.round === "Seizièmes") continue; // déjà réels au calendrier
    if (realPhases.has(r.round)) continue; // ce tour est déjà en base
    for (const m of r.matches) {
      const date = KNOCKOUT_SCHEDULE[m.fifaNo];
      if (!date) continue;
      out.push({
        id: `proj-${m.code}`,
        team_a: m.a.teamName ?? m.a.label,
        team_b: m.b.teamName ?? m.b.label,
        flag_a: m.a.teamFlag,
        flag_b: m.b.teamFlag,
        starts_at: date,
        phase: r.round,
        status: "upcoming",
        projected: true,
      });
    }
  }
  return out;
}
