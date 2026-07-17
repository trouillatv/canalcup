// Classements de poule baby-foot — helper pur (réutilisé par les awards, le hub
// public et la TV). Aucune I/O : on lui passe les entries + les matchs.

import type { BabyFootMatch } from "@/lib/supabase/types";

export interface EntryLite {
  id: string;
  team_id: string;
  pool_label?: string | null;
  forfeited?: boolean | null; // binôme déclaré forfait : classé dernier, jamais qualifié
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
    const ea = m.team_a_id ? byTeam.get(m.team_a_id) : undefined;
    const eb = m.team_b_id ? byTeam.get(m.team_b_id) : undefined;
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

// ── Classement du mini-championnat (V2) : un SEUL groupe ─────────────────────
export interface ChampStanding {
  entry_id: string;
  team_id: string;
  played: number; won: number; lost: number; gf: number; ga: number; gd: number;
  rank: number;
  qualified: boolean;
  forfeited: boolean;
}

/**
 * Classement général du championnat. Tri : victoires ↓, diff ↓, BP ↓, puis
 * confrontation directe (2 à 2), puis ordre stable (= tirage au sort figé).
 * Un binôme forfait est classé dernier et n'est jamais qualifié.
 */
export function computeChampionshipStandings(
  entries: EntryLite[],
  matches: BabyFootMatch[],
  qualifiers = 4
): ChampStanding[] {
  // Identité PARTICIPANT = l'entrée (marche pour officiels et paires ad-hoc).
  const acc = new Map<string, ChampStanding>();
  for (const e of entries) {
    acc.set(e.id, { entry_id: e.id, team_id: e.team_id, played: 0, won: 0, lost: 0, gf: 0, ga: 0, gd: 0, rank: 0, qualified: false, forfeited: !!e.forfeited });
  }
  // Confrontation directe : winner par paire d'entry_id.
  const h2h = new Map<string, string>(); // `${x}|${y}` (trié) → entry_id vainqueur
  const key = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);

  for (const m of matches) {
    if (m.phase !== "league" || !isScored(m)) continue;
    const ida = m.entry_a_id ?? null, idb = m.entry_b_id ?? null;
    const sa = m.score_a ?? 0, sb = m.score_b ?? 0;
    if (ida && acc.has(ida)) { const s = acc.get(ida)!; s.played++; s.gf += sa; s.ga += sb; if (sa > sb) s.won++; else s.lost++; }
    if (idb && acc.has(idb)) { const s = acc.get(idb)!; s.played++; s.gf += sb; s.ga += sa; if (sb > sa) s.won++; else s.lost++; }
    if (ida && idb && sa !== sb) h2h.set(key(ida, idb), sa > sb ? ida : idb);
  }

  const list = [...acc.values()];
  for (const s of list) s.gd = s.gf - s.ga;
  list.sort((a, b) => {
    if (a.forfeited !== b.forfeited) return a.forfeited ? 1 : -1; // forfaits en bas de tableau
    if (b.won !== a.won) return b.won - a.won;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const w = h2h.get(key(a.entry_id, b.entry_id)); // confrontation directe
    if (w === a.entry_id) return -1;
    if (w === b.entry_id) return 1;
    return a.entry_id.localeCompare(b.entry_id); // ordre stable
  });
  list.forEach((s, i) => { s.rank = i + 1; s.qualified = i < qualifiers && !s.forfeited; });
  return list;
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
