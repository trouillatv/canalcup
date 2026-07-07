// Moteur de points baby-foot — DÉTERMINISTE et IDEMPOTENT.
//
// À partir de l'état des matchs, calcule le PALIER de chaque binôme (son
// résultat) et réécrit intégralement le registre babyfoot_awards de l'édition
// (delete + insert) → recalculer après correction d'un score ne duplique jamais
// et converge toujours vers le même résultat. Un binôme = UN palier (le plus
// haut atteint). Valeur faciale depuis lib/config/babyfoot.ts.

import { BABYFOOT, BABYFOOT_STAGE_ORDER, type BabyfootStage } from "@/lib/config/babyfoot";
import { computePoolStandings, qualifiedEntryIds, type EntryLite } from "@/lib/babyfoot/standings";
import type { BabyFootMatch } from "@/lib/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

const rank = (s: BabyfootStage) => BABYFOOT_STAGE_ORDER.indexOf(s);
function bump(map: Map<string, BabyfootStage>, id: string, s: BabyfootStage) {
  const cur = map.get(id) ?? "participation";
  if (rank(s) > rank(cur)) map.set(id, s);
}

const PHASE_TIER: Record<string, BabyfootStage> = {
  quarter: "qualified",
  semi: "semifinalist",
  final: "finalist",
};

export interface RecomputeResult {
  ok: boolean;
  awarded?: number;
  championEntryId?: string | null;
  error?: string;
}

/**
 * Recalcule et réécrit tous les awards d'une édition. Sans écriture de points
 * tant que le tournoi n'a pas atteint la phase de jeu (pools/knockout/finished).
 */
export async function recomputeAwards(admin: DbClient, tournamentId: string): Promise<RecomputeResult> {
  const { data: t } = await admin
    .from("babyfoot_tournaments")
    .select("id, status, format")
    .eq("id", tournamentId)
    .maybeSingle();
  if (!t) return { ok: false, error: "Édition introuvable" };

  const [{ data: entriesRaw }, { data: matchesRaw }] = await Promise.all([
    admin.from("babyfoot_entries").select("id, team_id, pool_label").eq("tournament_id", tournamentId),
    admin
      .from("babyfoot_matches")
      .select("id, team_a_id, team_b_id, score_a, score_b, status, phase")
      .eq("tournament_id", tournamentId),
  ]);
  const entries = (entriesRaw ?? []) as EntryLite[];
  const matches = (matchesRaw ?? []) as BabyFootMatch[];

  // Table rase : on repart toujours d'un registre vierge pour l'édition.
  await admin.from("babyfoot_awards").delete().eq("tournament_id", tournamentId);
  await admin.from("babyfoot_entries").update({ final_rank: null }).eq("tournament_id", tournamentId);

  const scoringOn = ["pools", "knockout", "finished"].includes(t.status);
  if (!scoringOn || entries.length === 0) return { ok: true, awarded: 0 };

  const entryByTeam = new Map(entries.map((e) => [e.team_id, e.id]));
  const tier = new Map<string, BabyfootStage>();
  for (const e of entries) tier.set(e.id, "participation"); // plancher : a participé

  // Sortis des poules (top 2) → au moins "qualified".
  if (t.format === "pools_ko") {
    const standings = computePoolStandings(entries, matches);
    for (const id of qualifiedEntryIds(standings, 2)) bump(tier, id, "qualified");
  }

  // Profondeur atteinte dans le tableau (apparaître dans un match d'une phase =
  // avoir atteint cette phase).
  for (const m of matches) {
    const pt = m.phase ? PHASE_TIER[m.phase] : undefined;
    if (!pt) continue;
    for (const teamId of [m.team_a_id, m.team_b_id]) {
      const eid = entryByTeam.get(teamId);
      if (eid) bump(tier, eid, pt);
    }
  }

  // Champion = vainqueur de la finale jouée.
  let championEntryId: string | null = null;
  let finalistEntryId: string | null = null;
  const final = matches.find(
    (m) => m.phase === "final" && m.status === "finished" && m.score_a != null && m.score_b != null
  );
  if (final) {
    const sa = final.score_a ?? 0;
    const sb = final.score_b ?? 0;
    const winTeam = sa > sb ? final.team_a_id : sb > sa ? final.team_b_id : null;
    if (winTeam) {
      const loseTeam = winTeam === final.team_a_id ? final.team_b_id : final.team_a_id;
      const wEid = entryByTeam.get(winTeam);
      const lEid = entryByTeam.get(loseTeam);
      if (wEid) { bump(tier, wEid, "champion"); championEntryId = wEid; }
      if (lEid) finalistEntryId = lEid;
    }
  }

  // Rang final (mémoire/podium) : 1 champion, 2 finaliste, 3/4 petite finale.
  const finalRank = new Map<string, number>();
  if (championEntryId) finalRank.set(championEntryId, 1);
  if (finalistEntryId) finalRank.set(finalistEntryId, 2);
  const third = matches.find(
    (m) => m.phase === "third" && m.status === "finished" && m.score_a != null && m.score_b != null
  );
  if (third) {
    const sa = third.score_a ?? 0;
    const sb = third.score_b ?? 0;
    const winTeam = sa > sb ? third.team_a_id : sb > sa ? third.team_b_id : null;
    if (winTeam) {
      const loseTeam = winTeam === third.team_a_id ? third.team_b_id : third.team_a_id;
      const w = entryByTeam.get(winTeam);
      const l = entryByTeam.get(loseTeam);
      if (w) finalRank.set(w, 3);
      if (l) finalRank.set(l, 4);
    }
  }

  // Écriture du registre (1 ligne = 1 binôme = son palier, valeur faciale).
  const rows = entries.map((e) => {
    const stage = tier.get(e.id) ?? "participation";
    return {
      tournament_id: tournamentId,
      entry_id: e.id,
      team_id: e.team_id,
      stage,
      points: BABYFOOT.bareme[stage],
      label: BABYFOOT.stageLabel[stage],
    };
  });
  if (rows.length) await admin.from("babyfoot_awards").insert(rows);

  // Rangs finaux.
  for (const [entryId, r] of finalRank) {
    await admin.from("babyfoot_entries").update({ final_rank: r }).eq("id", entryId);
  }

  return { ok: true, awarded: rows.length, championEntryId };
}
