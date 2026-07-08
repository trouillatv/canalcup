// Enjeux du championnat baby-foot — helpers PURS (réutilisés admin jour J + TV).
// But : faire vivre le classement ("déjà qualifié", "une victoire = qualif",
// "N binômes se battent pour le Top 4") plutôt que d'enchaîner des scores muets.

import { BABYFOOT } from "@/lib/config/babyfoot";

/** Points de barème gagnés en remportant un match, selon la phase. */
export function pointsForWin(phase: string | null | undefined): { pts: number; label: string } | null {
  const b = BABYFOOT.bareme;
  switch (phase) {
    case "league": return { pts: b.matchWin, label: "points championnat" };
    case "semi": return { pts: b.semiWin, label: "demi-finale gagnée" };
    case "final": return { pts: b.champion, label: "CHAMPION 🏆" };
    default: return null; // petite finale : pas de palier de barème
  }
}

export interface StakeRow { team_id: string; label: string; won: number; played: number; rank: number; }
export interface Stakes { clinched: string[]; oneWinAway: string[]; bubble: number; qualifiers: number; }

/**
 * Scénarios de qualification — clinch CONSERVATEUR (aux victoires uniquement ;
 * les égalités sont supposées défavorables à l'équipe testée, donc "déjà
 * qualifié" n'est jamais faux). Un binôme est qualifié si strictement moins de
 * `qualifiers` AUTRES binômes peuvent encore atteindre son total de victoires.
 */
export function championshipStakes(
  rows: StakeRow[],
  remainingByTeam: Map<string, number>,
  qualifiers = BABYFOOT.qualifiers
): Stakes {
  const maxWins = (r: StakeRow) => r.won + (remainingByTeam.get(r.team_id) ?? 0);
  const clinchedAt = (wins: number, selfId: string) =>
    rows.filter((o) => o.team_id !== selfId && maxWins(o) >= wins).length < qualifiers;

  const clinched: string[] = [];
  const oneWinAway: string[] = [];
  for (const r of rows) {
    if (clinchedAt(r.won, r.team_id)) { clinched.push(r.label); continue; }
    const rem = remainingByTeam.get(r.team_id) ?? 0;
    if (rem > 0 && clinchedAt(r.won + 1, r.team_id)) oneWinAway.push(r.label);
  }
  // Binômes encore EN LICE pour la dernière place qualificative (hors déjà qualifiés).
  const fourth = rows.find((r) => r.rank === qualifiers);
  const threshold = fourth ? fourth.won : 0;
  const bubble = rows.filter(
    (r) => !clinched.includes(r.label) && r.rank > qualifiers && maxWins(r) >= threshold
  ).length;
  return { clinched, oneWinAway, bubble, qualifiers };
}
