// Classements de poule baby-foot — helper pur (réutilisé par les awards, le hub
// public et la TV). Aucune I/O : on lui passe les entries + les matchs.

import type { BabyFootMatch } from "@/lib/supabase/types";

export interface EntryLite {
  id: string;
  team_id: string;
  pool_label?: string | null;
}

export interface PoolStanding {
  entry_id: string;
  team_id: string;
  pool: string;
  played: number;
  won: number;
  lost: number;
  gf: number; // buts pour
  ga: number; // buts contre
  gd: number; // différence
  rank: number; // rang dans la poule (1 = premier)
}

// Un match "compte" pour les stats/classement s'il est terminé avec un score.
function isScored(m: BabyFootMatch): boolean {
  return m.status === "finished" && m.score_a != null && m.score_b != null;
}

/**
 * Classement par poule. Tri : victoires ↓, différence de buts ↓, buts pour ↓.
 * (Pas de points de poule séparés : en baby-foot on classe aux victoires.)
 */
export function computePoolStandings(
  entries: EntryLite[],
  matches: BabyFootMatch[]
): Map<string, PoolStanding[]> {
  const byTeam = new Map<string, EntryLite>();
  for (const e of entries) byTeam.set(e.team_id, e);

  // Accumulateur par entry.
  const acc = new Map<string, PoolStanding>();
  for (const e of entries) {
    if (!e.pool_label) continue;
    acc.set(e.id, {
      entry_id: e.id,
      team_id: e.team_id,
      pool: e.pool_label,
      played: 0, won: 0, lost: 0, gf: 0, ga: 0, gd: 0, rank: 0,
    });
  }

  for (const m of matches) {
    if (m.phase !== "pool" || !isScored(m)) continue;
    const ea = byTeam.get(m.team_a_id);
    const eb = byTeam.get(m.team_b_id);
    const sa = m.score_a ?? 0;
    const sb = m.score_b ?? 0;
    if (ea && acc.has(ea.id)) {
      const s = acc.get(ea.id)!;
      s.played++; s.gf += sa; s.ga += sb;
      if (sa > sb) s.won++; else if (sa < sb) s.lost++;
    }
    if (eb && acc.has(eb.id)) {
      const s = acc.get(eb.id)!;
      s.played++; s.gf += sb; s.ga += sa;
      if (sb > sa) s.won++; else if (sb < sa) s.lost++;
    }
  }

  // Regroupe par poule + tri + rangs.
  const pools = new Map<string, PoolStanding[]>();
  for (const s of acc.values()) {
    s.gd = s.gf - s.ga;
    if (!pools.has(s.pool)) pools.set(s.pool, []);
    pools.get(s.pool)!.push(s);
  }
  for (const [, list] of pools) {
    list.sort((a, b) => b.won - a.won || b.gd - a.gd || b.gf - a.gf);
    list.forEach((s, i) => (s.rank = i + 1));
  }
  return pools;
}

/** Ids des entries qualifiées (top `perPool` de chaque poule). */
export function qualifiedEntryIds(
  standings: Map<string, PoolStanding[]>,
  perPool = 2
): Set<string> {
  const out = new Set<string>();
  for (const [, list] of standings) {
    list.slice(0, perPool).forEach((s) => out.add(s.entry_id));
  }
  return out;
}
