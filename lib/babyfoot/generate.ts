// Génération du tournoi — helper PUR (aucune I/O). Produit des DESCRIPTEURS de
// matchs avec chaînage par identifiants LOCAUX ; la route admin insère en base
// puis résout next_match_id à partir de la map localId → id réel.
//
// Deux étages :
//   generatePools()     — répartition en poules + matchs de poule (round robin).
//   generateKnockout()  — tableau à élimination (barrages → quarts → demies →
//                         finale + petite finale) avec chaînage des vainqueurs
//                         ET des perdants de demie (petite finale).

import type { BabyfootPhase } from "@/lib/supabase/types";

export interface GenMatch {
  localId: string;
  phase: BabyfootPhase;
  pool_label: string | null;
  round: string; // libellé lisible
  team_a_id: string | null;
  team_b_id: string | null;
  target_score: number;
  order_idx: number;
  next_local_id: string | null; // vainqueur →
  next_slot: "a" | "b" | null;
  loser_next_local_id: string | null; // perdant → (petite finale)
  loser_next_slot: "a" | "b" | null;
}

const POOL_LABELS = ["A", "B", "C", "D", "E", "F"];

export interface PoolPlan {
  assignments: { teamId: string; pool_label: string }[];
  matches: GenMatch[];
}

/** Répartit les équipes en poules (round-robin d'affectation) + matchs de poule. */
export function generatePools(teamIds: string[], sizes: number[], poolTarget: number): PoolPlan {
  const nPools = sizes.length;
  const pools: string[][] = Array.from({ length: nPools }, () => []);
  teamIds.forEach((id, i) => pools[i % nPools].push(id));

  const assignments: { teamId: string; pool_label: string }[] = [];
  const matches: GenMatch[] = [];
  let order = 0;
  pools.forEach((members, p) => {
    const label = POOL_LABELS[p];
    members.forEach((teamId) => assignments.push({ teamId, pool_label: label }));
    // Round robin : toutes les paires de la poule.
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        matches.push({
          localId: `pool_${label}_${i}_${j}`,
          phase: "pool",
          pool_label: label,
          round: `Poule ${label}`,
          team_a_id: members[i],
          team_b_id: members[j],
          target_score: poolTarget,
          order_idx: order++,
          next_local_id: null, next_slot: null,
          loser_next_local_id: null, loser_next_slot: null,
        });
      }
    }
  });
  return { assignments, matches };
}

// ── Phase 1 : mini-championnat (méthode du cercle / round-robin) ──────────────
// Chaque binôme joue `matchesPerTeam` adversaires DISTINCTS (jamais deux fois le
// même). Pour un nb PAIR de binômes, tout le monde joue exactement ce nombre.
function roundRobinRounds(ids: string[]): [string, string][][] {
  const arr: (string | null)[] = [...ids];
  if (arr.length % 2 === 1) arr.push(null); // "bye" si impair
  const n = arr.length;
  const rounds: [string, string][][] = [];
  const fixed = arr[0];
  let rot = arr.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const day = [fixed, ...rot];
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = day[i], b = day[n - 1 - i];
      if (a && b) pairs.push([a, b]);
    }
    rounds.push(pairs);
    rot = [rot[rot.length - 1], ...rot.slice(0, rot.length - 1)]; // rotation
  }
  return rounds;
}

export function generateChampionship(
  teamIds: string[],
  matchesPerTeam: number,
  koTarget: number
): GenMatch[] {
  const rounds = roundRobinRounds(teamIds).slice(0, matchesPerTeam);
  const matches: GenMatch[] = [];
  let order = 0;
  rounds.forEach((pairs, r) => {
    pairs.forEach(([a, b], i) => {
      matches.push({
        localId: `league_${r}_${i}`,
        phase: "league", pool_label: null, round: `Journée ${r + 1}`,
        team_a_id: a, team_b_id: b,
        target_score: koTarget, order_idx: order++,
        next_local_id: null, next_slot: null,
        loser_next_local_id: null, loser_next_slot: null,
      });
    });
  });
  return matches;
}

function largestPow2LE(n: number): number {
  let p = 1;
  while (p * 2 <= n) p *= 2;
  return p;
}

const roundLabel = (matchesInRound: number, i: number): { phase: BabyfootPhase; label: string } => {
  if (matchesInRound === 1) return { phase: "final", label: "Finale" };
  if (matchesInRound === 2) return { phase: "semi", label: `Demi-finale ${i + 1}` };
  return { phase: "quarter", label: `Quart ${i + 1}` };
};

/**
 * Tableau à élimination directe pour des équipes SEEDÉES (meilleur seed en tête).
 * Gère les tours de barrage (prelim) quand le nb d'équipes n'est pas une
 * puissance de 2 (cap à 16 équipes → tableau principal de 8).
 */
export function generateKnockout(
  seededTeamIds: string[],
  opts: { koTarget: number; finalTarget: number; startOrder?: number }
): GenMatch[] {
  const m = seededTeamIds.length;
  if (m < 2) return [];
  const mainSize = Math.min(8, largestPow2LE(m));
  const prelimCount = m - mainSize; // nb de barrages
  const byes = 2 * mainSize - m; // équipes exemptées de barrage
  const matches: GenMatch[] = [];
  let order = opts.startOrder ?? 0;

  const byeTeams = seededTeamIds.slice(0, byes);
  const prelimTeams = seededTeamIds.slice(byes); // 2 * prelimCount équipes

  // ── Tableau principal : rounds du 1er tour → finale ─────────────────────────
  const rounds: GenMatch[][] = [];
  let count = mainSize / 2;
  let roundIdx = 0;
  while (count >= 1) {
    const round: GenMatch[] = [];
    for (let i = 0; i < count; i++) {
      const { phase, label } = roundLabel(count, i);
      round.push({
        localId: `ko_r${roundIdx}_${i}`,
        phase, pool_label: null, round: label,
        team_a_id: null, team_b_id: null,
        target_score: phase === "final" ? opts.finalTarget : opts.koTarget,
        order_idx: 0, // fixé plus bas (barrages d'abord)
        next_local_id: null, next_slot: null,
        loser_next_local_id: null, loser_next_slot: null,
      });
    }
    rounds.push(round);
    if (count === 1) break;
    count = count / 2;
    roundIdx++;
  }

  // Chaînage vainqueur entre rounds.
  for (let r = 0; r < rounds.length - 1; r++) {
    rounds[r].forEach((mt, i) => {
      const parent = rounds[r + 1][Math.floor(i / 2)];
      mt.next_local_id = parent.localId;
      mt.next_slot = i % 2 === 0 ? "a" : "b";
    });
  }

  // Slots du 1er tour : byes (équipes connues) puis placeholders de barrage.
  const firstRound = rounds[0];
  const setSlot = (slotIndex: number, teamId: string | null): { matchLocal: string; slot: "a" | "b" } => {
    const mt = firstRound[Math.floor(slotIndex / 2)];
    const slot: "a" | "b" = slotIndex % 2 === 0 ? "a" : "b";
    if (teamId) { if (slot === "a") mt.team_a_id = teamId; else mt.team_b_id = teamId; }
    return { matchLocal: mt.localId, slot };
  };
  for (let i = 0; i < byes; i++) setSlot(i, byeTeams[i]);

  // ── Barrages (prelim) : perdants dehors, vainqueurs → placeholders ──────────
  const prelim: GenMatch[] = [];
  for (let i = 0; i < prelimCount; i++) {
    const a = prelimTeams[i];
    const b = prelimTeams[prelimTeams.length - 1 - i];
    const dest = setSlot(byes + i, null); // placeholder → où va le vainqueur
    prelim.push({
      localId: `prelim_${i}`,
      phase: "prelim", pool_label: null, round: `Barrage ${i + 1}`,
      team_a_id: a, team_b_id: b,
      target_score: opts.koTarget,
      order_idx: 0,
      next_local_id: dest.matchLocal, next_slot: dest.slot,
      loser_next_local_id: null, loser_next_slot: null,
    });
  }

  // ── Petite finale : perdants de la demie (round à 2 matchs) ─────────────────
  const semiRound = rounds.find((r) => r.length === 2);
  let third: GenMatch | null = null;
  if (semiRound) {
    third = {
      localId: "third",
      phase: "third", pool_label: null, round: "Petite finale",
      team_a_id: null, team_b_id: null,
      target_score: opts.koTarget,
      order_idx: 0,
      next_local_id: null, next_slot: null,
      loser_next_local_id: null, loser_next_slot: null,
    };
    semiRound.forEach((sm, i) => {
      sm.loser_next_local_id = third!.localId;
      sm.loser_next_slot = i === 0 ? "a" : "b";
    });
  }

  // Ordre d'affichage : barrages → quarts → demies → finale → petite finale.
  for (const mt of prelim) mt.order_idx = order++;
  for (const round of rounds) for (const mt of round) mt.order_idx = order++;
  if (third) third.order_idx = order++;

  matches.push(...prelim, ...rounds.flat());
  if (third) matches.push(third);
  return matches;
}
