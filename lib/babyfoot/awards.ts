// Moteur de points baby-foot V2 (championnat) — DÉTERMINISTE & IDEMPOTENT.
//
// Barème CUMULATIF (valeur faciale) : Participation 5 · +5 par match de
// championnat DISPUTÉ (max 15) · +5 par victoire de championnat (max 15) ·
// Qualif en demie 10 · Victoire de demie 15 · Champion 20.
// → max 80 (cf. championMaxPoints()). Plusieurs lignes par binôme (1 par
// palier). recomputeAwards réécrit intégralement le registre (delete + insert).

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
    admin.from("babyfoot_entries").select("id, team_id, kind, forfeited").eq("tournament_id", tournamentId),
    admin.from("babyfoot_matches").select("id, entry_a_id, entry_b_id, team_a_id, team_b_id, score_a, score_b, status, phase").eq("tournament_id", tournamentId),
  ]);
  const entries = (entriesRaw ?? []) as (EntryLite & { kind?: string | null })[];
  const matches = (matchesRaw ?? []) as BabyFootMatch[];

  await admin.from("babyfoot_awards").delete().eq("tournament_id", tournamentId);
  await admin.from("babyfoot_entries").update({ final_rank: null }).eq("tournament_id", tournamentId);

  const scoringOn = ["pools", "knockout", "finished"].includes(t.status);
  if (!scoringOn || entries.length === 0) return { ok: true, awarded: 0 };

  const b = BABYFOOT.bareme;

  // Classement championnat → victoires + qualifiés (top 4).
  const standings = computeChampionshipStandings(entries, matches, BABYFOOT.qualifiers);
  const winsByEntry = new Map(standings.map((s) => [s.entry_id, s.won]));
  const playedByEntry = new Map(standings.map((s) => [s.entry_id, s.played]));
  const qualified = new Set(standings.filter((s) => s.qualified).map((s) => s.entry_id));

  // Résultats de phase finale — winnerOf / loserOf renvoient des ENTRY ids.
  const winnerOf = (m: BabyFootMatch): string | null => {
    if (m.status !== "finished" || m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null;
    return m.score_a > m.score_b ? m.entry_a_id ?? null : m.entry_b_id ?? null;
  };
  const loserOf = (m: BabyFootMatch): string | null => {
    if (m.status !== "finished" || m.score_a == null || m.score_b == null || m.score_a === m.score_b) return null;
    return m.score_a > m.score_b ? m.entry_b_id ?? null : m.entry_a_id ?? null;
  };
  const semiWinners = new Set<string>();
  for (const m of matches) if (m.phase === "semi") { const w = winnerOf(m); if (w) semiWinners.add(w); }

  const finalMatch = matches.find((m) => m.phase === "final");
  const championEntryId: string | null = finalMatch ? winnerOf(finalMatch) : null;
  const finalistEntryId: string | null = finalMatch ? loserOf(finalMatch) : null;

  // Construction du registre (cumulatif).
  type Row = { tournament_id: string; entry_id: string; team_id: string | null; stage: string; points: number; label: string };
  const rows: Row[] = [];
  // Une paire ad-hoc n'a pas d'équipe RSE derrière elle : son award porte
  // team_id NULL → points INDIVIDUELS aux 2 joueurs, aucun point équipe.
  const push = (e: EntryLite & { kind?: string | null }, stage: string, points: number, label: string) =>
    rows.push({
      tournament_id: tournamentId, entry_id: e.id,
      team_id: e.kind === "open" ? null : e.team_id,
      stage, points, label,
    });

  for (const e of entries) {
    // Forfait : le binôme n'a pas participé → AUCUN point, pas même les 5 de
    // participation. Ses adversaires ont gagné par forfait, lui reste au registre
    // à zéro.
    if (e.forfeited) continue;
    push(e, "participation", b.participation, BABYFOOT.stageLabel.participation);
    const wins = winsByEntry.get(e.id) ?? 0;
    const played = playedByEntry.get(e.id) ?? 0;
    // +5 par match DISPUTÉ (victoire ou défaite) + 5 par victoire, cumulés dans phase1.
    const phase1Pts = played * b.matchPlayed + wins * b.matchWin;
    if (phase1Pts > 0) push(e, "phase1", phase1Pts, `${played} match(s) joué(s), ${wins} gagné(s)`);
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
    const w = winnerOf(third), l = loserOf(third);
    if (w) finalRank.set(w, 3);
    if (l) finalRank.set(l, 4);
  }
  for (const [entryId, r] of finalRank) await admin.from("babyfoot_entries").update({ final_rank: r }).eq("id", entryId);

  return { ok: true, awarded: rows.length, championEntryId };
}
