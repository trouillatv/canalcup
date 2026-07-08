// Moteur de points baby-foot V2 (championnat) — DÉTERMINISTE & IDEMPOTENT.
//
// Barème CUMULATIF (valeur faciale) : Participation 5 · +5 par victoire de
// championnat (max 15) · Qualif en demie 10 · Victoire de demie 15 · Champion 20.
// → max 65. Plusieurs lignes par binôme (1 par palier). recomputeAwards réécrit
// intégralement le registre de l'édition (delete + insert).

import { BABYFOOT } from "@/lib/config/babyfoot";
import { computeChampionshipStandings, type EntryLite } from "@/lib/babyfoot/standings";
import type { BabyFootMatch } from "@/lib/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export interface RecomputeResult {
  ok: boolean;
  awarded?: number;
  championEntryId?: string | null;
  error?: string;
}

export async function recomputeAwards(admin: DbClient, tournamentId: string): Promise<RecomputeResult> {
  const { data: t } = await admin
    .from("babyfoot_tournaments").select("id, status").eq("id", tournamentId).maybeSingle();
  if (!t) return { ok: false, error: "Édition introuvable" };

  const [{ data: entriesRaw }, { data: matchesRaw }] = await Promise.all([
    admin.from("babyfoot_entries").select("id, team_id").eq("tournament_id", tournamentId),
    admin.from("babyfoot_matches").select("id, team_a_id, team_b_id, score_a, score_b, status, phase").eq("tournament_id", tournamentId),
  ]);
  const entries = (entriesRaw ?? []) as EntryLite[];
  const matches = (matchesRaw ?? []) as BabyFootMatch[];

  await admin.from("babyfoot_awards").delete().eq("tournament_id", tournamentId);
  await admin.from("babyfoot_entries").update({ final_rank: null }).eq("tournament_id", tournamentId);

  const scoringOn = ["pools", "knockout", "finished"].includes(t.status);
  if (!scoringOn || entries.length === 0) return { ok: true, awarded: 0 };

  const entryByTeam = new Map(entries.map((e) => [e.team_id, e.id]));
  const b = BABYFOOT.bareme;

  // Classement championnat → victoires + qualifiés (top 4).
  const standings = computeChampionshipStandings(entries, matches, BABYFOOT.qualifiers);
  const winsByEntry = new Map(standings.map((s) => [s.entry_id, s.won]));
  const qualified = new Set(standings.filter((s) => s.qualified).map((s) => s.entry_id));

  // Résultats de phase finale.
  const winnerOf = (m: BabyFootMatch): string | null => {
    if (m.status !== "finished" || m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null;
    return m.score_a > m.score_b ? m.team_a_id ?? null : m.team_b_id ?? null;
  };
  const semiWinners = new Set<string>();
  for (const m of matches) if (m.phase === "semi") { const w = winnerOf(m); const e = w && entryByTeam.get(w); if (e) semiWinners.add(e); }

  let championEntryId: string | null = null, finalistEntryId: string | null = null;
  const finalMatch = matches.find((m) => m.phase === "final");
  if (finalMatch) {
    const w = winnerOf(finalMatch);
    if (w) {
      const loser = w === finalMatch.team_a_id ? finalMatch.team_b_id : finalMatch.team_a_id;
      championEntryId = entryByTeam.get(w) ?? null;
      finalistEntryId = (loser && entryByTeam.get(loser)) || null;
    }
  }

  // Construction du registre (cumulatif).
  type Row = { tournament_id: string; entry_id: string; team_id: string; stage: string; points: number; label: string };
  const rows: Row[] = [];
  const push = (e: EntryLite, stage: string, points: number, label: string) =>
    rows.push({ tournament_id: tournamentId, entry_id: e.id, team_id: e.team_id, stage, points, label });

  for (const e of entries) {
    push(e, "participation", b.participation, BABYFOOT.stageLabel.participation);
    const wins = winsByEntry.get(e.id) ?? 0;
    if (wins > 0) push(e, "phase1", wins * b.matchWin, `${BABYFOOT.stageLabel.phase1} (${wins})`);
    if (qualified.has(e.id)) push(e, "qualified", b.qualified, BABYFOOT.stageLabel.qualified);
    if (semiWinners.has(e.id)) push(e, "semi_win", b.semiWin, BABYFOOT.stageLabel.semi_win);
    if (championEntryId === e.id) push(e, "champion", b.champion, BABYFOOT.stageLabel.champion);
  }
  if (rows.length) await admin.from("babyfoot_awards").insert(rows);

  // Rang final (podium) : 1 champion, 2 finaliste, 3/4 petite finale.
  const finalRank = new Map<string, number>();
  if (championEntryId) finalRank.set(championEntryId, 1);
  if (finalistEntryId) finalRank.set(finalistEntryId, 2);
  const third = matches.find((m) => m.phase === "third");
  if (third) {
    const w = winnerOf(third);
    if (w) {
      const loser = w === third.team_a_id ? third.team_b_id : third.team_a_id;
      const we = entryByTeam.get(w); const le = loser && entryByTeam.get(loser);
      if (we) finalRank.set(we, 3);
      if (le) finalRank.set(le, 4);
    }
  }
  for (const [entryId, r] of finalRank) await admin.from("babyfoot_entries").update({ final_rank: r }).eq("id", entryId);

  return { ok: true, awarded: rows.length, championEntryId };
}
