// Persistance des matchs générés : insère un lot de GenMatch et résout le
// chaînage (localId → id réel) pour next_match_id / loser_next_match_id.
// Partagé par la route admin de génération et les tests d'intégration.

import type { GenMatch } from "@/lib/babyfoot/generate";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export interface ScheduleSlot { rotation: number | null; table_no: number | null; startISO: string | null; }

export async function insertGenMatches(
  admin: DbClient,
  tournamentId: string,
  gen: GenMatch[],
  scheduleByLocal?: Map<string, ScheduleSlot>,
  // entryId → team_id (officiels) ; permet de garder team_a_id/team_b_id pour les
  // libellés/stats legacy. Les paires ad-hoc n'y figurent pas (team_id null).
  teamByEntry?: Map<string, string | null>
): Promise<void> {
  if (!gen.length) return;
  const teamOf = (entryId: string | null | undefined) => (entryId ? teamByEntry?.get(entryId) ?? null : null);
  const rows = gen.map((g) => {
    const s = scheduleByLocal?.get(g.localId);
    return {
      tournament_id: tournamentId,
      phase: g.phase, pool_label: g.pool_label, round: g.round,
      // g.team_a_id/team_b_id portent désormais l'identité PARTICIPANT = entry_id.
      entry_a_id: g.team_a_id, entry_b_id: g.team_b_id,
      team_a_id: teamOf(g.team_a_id), team_b_id: teamOf(g.team_b_id),
      target_score: g.target_score, order_idx: g.order_idx,
      rotation: s?.rotation ?? null, table_no: s?.table_no ?? null,
      status: "upcoming" as const, starts_at: s?.startISO ?? null,
    };
  });
  // Insertion en bloc : PostgREST renvoie les lignes dans l'ordre d'entrée.
  const { data: inserted, error } = await admin.from("babyfoot_matches").insert(rows).select("id");
  if (error || !inserted) throw new Error(error?.message ?? "Insertion matchs impossible");
  const idByLocal = new Map<string, string>();
  gen.forEach((g, i) => idByLocal.set(g.localId, (inserted[i] as { id: string }).id));
  // 2e passe : chaînage vainqueur + perdant (petite finale).
  for (const g of gen) {
    const patch: Record<string, unknown> = {};
    if (g.next_local_id) { patch.next_match_id = idByLocal.get(g.next_local_id); patch.next_slot = g.next_slot; }
    if (g.loser_next_local_id) { patch.loser_next_match_id = idByLocal.get(g.loser_next_local_id); patch.loser_next_slot = g.loser_next_slot; }
    if (Object.keys(patch).length) await admin.from("babyfoot_matches").update(patch).eq("id", idByLocal.get(g.localId)!);
  }
}

/**
 * Enregistre un score et fait avancer le tableau : vainqueur → next_match,
 * perdant → loser_next_match (petite finale). Sans recompute (à appeler après).
 * Retourne false si le match est introuvable ou les scores invalides/égaux.
 */
export async function applyResult(admin: DbClient, matchId: string, a: number, b: number): Promise<boolean> {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0 || a === b) return false;
  const { data: m } = await admin
    .from("babyfoot_matches")
    .select("id, entry_a_id, entry_b_id, team_a_id, team_b_id, next_match_id, next_slot, loser_next_match_id, loser_next_slot")
    .eq("id", matchId)
    .maybeSingle();
  if (!m) return false;
  await admin.from("babyfoot_matches").update({ score_a: a, score_b: b, status: "finished" }).eq("id", matchId);
  // Avancement basé sur l'ENTRÉE (marche pour officiels et paires ad-hoc). On
  // recopie aussi team_* quand connu, pour les libellés/stats legacy.
  const winEntry = a > b ? m.entry_a_id : m.entry_b_id;
  const loseEntry = a > b ? m.entry_b_id : m.entry_a_id;
  const winTeam = a > b ? m.team_a_id : m.team_b_id;
  const loseTeam = a > b ? m.team_b_id : m.team_a_id;
  const advance = async (mid: string, slot: "a" | "b", entry: string | null, team: string | null) => {
    await admin.from("babyfoot_matches")
      .update({ [slot === "a" ? "entry_a_id" : "entry_b_id"]: entry, [slot === "a" ? "team_a_id" : "team_b_id"]: team })
      .eq("id", mid);
  };
  if (m.next_match_id && m.next_slot && winEntry) await advance(m.next_match_id, m.next_slot, winEntry, winTeam);
  if (m.loser_next_match_id && m.loser_next_slot && loseEntry) await advance(m.loser_next_match_id, m.loser_next_slot, loseEntry, loseTeam);
  return true;
}
