// Faits marquants EN DIRECT du tournoi — helper PUR. Dérivé des matchs terminés :
// plus grosse victoire, match le plus serré, plus prolifique, binôme invaincu,
// meilleure série, surprise (petit poucet qui sort un mieux classé).

import type { BabyFootMatch } from "@/lib/supabase/types";

export interface Highlights {
  biggestWin: { winner: string; loser: string; sa: number; sb: number; margin: number } | null;
  closest: { a: string; b: string; sa: number; sb: number } | null;
  highestScoring: { a: string; b: string; sa: number; sb: number; total: number } | null;
  undefeated: { label: string; won: number; played: number }[];
  bestStreak: { label: string; streak: number } | null;
  upset: { winner: string; loser: string; detail: string } | null;
}

interface Ctx {
  labelByTeam: Map<string, string>;
  poolRankByTeam?: Map<string, number>; // rang de poule (1 = 1er) pour la "surprise"
}

const scored = (m: BabyFootMatch) => m.status === "finished" && m.score_a != null && m.score_b != null;

export function computeHighlights(matches: BabyFootMatch[], ctx: Ctx): Highlights {
  const lbl = (id?: string | null) => (id ? ctx.labelByTeam.get(id) ?? "?" : "?");
  const done = matches.filter(scored).sort((a, b) => (a.order_idx ?? 0) - (b.order_idx ?? 0));

  const h: Highlights = { biggestWin: null, closest: null, highestScoring: null, undefeated: [], bestStreak: null, upset: null };

  // Stats par équipe : joués / gagnés / perdus + séquence chronologique (V/D).
  const stats = new Map<string, { played: number; won: number; lost: number; seq: boolean[] }>();
  const bump = (id: string | null | undefined, win: boolean) => {
    if (!id) return;
    if (!stats.has(id)) stats.set(id, { played: 0, won: 0, lost: 0, seq: [] });
    const s = stats.get(id)!;
    s.played++; if (win) s.won++; else s.lost++;
    s.seq.push(win);
  };

  for (const m of done) {
    const sa = m.score_a ?? 0, sb = m.score_b ?? 0;
    const margin = Math.abs(sa - sb);
    const total = sa + sb;
    const winId = sa > sb ? m.team_a_id : m.team_b_id;
    const loseId = sa > sb ? m.team_b_id : m.team_a_id;

    // Plus grosse victoire (plus gros écart).
    if (margin > 0 && (!h.biggestWin || margin > h.biggestWin.margin)) {
      h.biggestWin = { winner: lbl(winId), loser: lbl(loseId), sa: Math.max(sa, sb), sb: Math.min(sa, sb), margin };
    }
    // Match le plus serré (plus petit écart ; à égalité, le plus prolifique).
    if (margin > 0 && (!h.closest || margin < Math.abs(h.closest.sa - h.closest.sb) || (margin === Math.abs(h.closest.sa - h.closest.sb) && total > h.closest.sa + h.closest.sb))) {
      h.closest = { a: lbl(m.team_a_id), b: lbl(m.team_b_id), sa, sb };
    }
    // Plus grand nombre de buts.
    if (!h.highestScoring || total > h.highestScoring.total) {
      h.highestScoring = { a: lbl(m.team_a_id), b: lbl(m.team_b_id), sa, sb, total };
    }
    bump(m.team_a_id, sa > sb);
    bump(m.team_b_id, sb > sa);

    // Surprise : en phase finale, un binôme moins bien classé en poule sort un mieux classé.
    if (ctx.poolRankByTeam && m.phase && ["quarter", "semi", "final"].includes(m.phase) && winId && loseId) {
      const rw = ctx.poolRankByTeam.get(winId);
      const rl = ctx.poolRankByTeam.get(loseId);
      if (rw != null && rl != null && rw > rl) {
        h.upset = { winner: lbl(winId), loser: lbl(loseId), detail: `${rw}e de poule sort le ${rl}er` };
      }
    }
  }

  // Binômes invaincus (au moins 1 match, aucune défaite).
  h.undefeated = [...stats.entries()]
    .filter(([, s]) => s.played >= 1 && s.lost === 0)
    .map(([id, s]) => ({ label: lbl(id), won: s.won, played: s.played }))
    .sort((a, b) => b.won - a.won);

  // Meilleure série de victoires consécutives.
  for (const [id, s] of stats) {
    let cur = 0, best = 0;
    for (const w of s.seq) { cur = w ? cur + 1 : 0; best = Math.max(best, cur); }
    if (best >= 2 && (!h.bestStreak || best > h.bestStreak.streak)) h.bestStreak = { label: lbl(id), streak: best };
  }

  return h;
}
