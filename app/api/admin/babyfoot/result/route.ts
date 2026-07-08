// Saisie / correction d'un résultat de match baby-foot.
// POST { match_id, score_a, score_b } → enregistre, fait AVANCER le vainqueur
// (et le perdant de demie vers la petite finale), puis RECALCULE les points.
// Idempotent : corriger un score relance l'avancement + recomputeAwards.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { BABYFOOT } from "@/lib/config/babyfoot";
import { recomputeAwards } from "@/lib/babyfoot/awards";
import { applyResult, insertGenMatches } from "@/lib/babyfoot/persist";
import { generateKnockout } from "@/lib/babyfoot/generate";
import { computeChampionshipStandings } from "@/lib/babyfoot/standings";
import type { BabyFootMatch } from "@/lib/supabase/types";

// Auto-progression du tournoi APRÈS un résultat : quand le championnat est
// terminé, on génère AUTOMATIQUEMENT la phase finale (Top 4 → 1v4/2v3) et on
// passe en 'knockout' ; quand la finale est jouée, on clôture (podium). Aucun
// bouton manuel : la TV et l'orga voient l'événement se dérouler tout seul.
async function autoAdvance(admin: ReturnType<typeof createAdminClient>, tournamentId: string) {
  const { data: matchesRaw } = await admin.from("babyfoot_matches").select("*").eq("tournament_id", tournamentId);
  const ms = (matchesRaw ?? []) as BabyFootMatch[];
  const league = ms.filter((m) => m.phase === "league");
  const hasKo = ms.some((m) => m.phase && m.phase !== "league");
  const leagueDone = league.length > 0 && league.every((m) => m.status === "finished");

  if (leagueDone && !hasKo) {
    const { data: entriesRaw } = await admin.from("babyfoot_entries").select("id, team_id").eq("tournament_id", tournamentId);
    const entries = (entriesRaw ?? []) as { id: string; team_id: string }[];
    const standings = computeChampionshipStandings(entries, ms, BABYFOOT.qualifiers);
    const seeded = standings.slice(0, BABYFOOT.qualifiers).map((s) => s.team_id);
    if (seeded.length >= 2) {
      const { data: tRow } = await admin.from("babyfoot_tournaments").select("ko_target, final_target").eq("id", tournamentId).maybeSingle();
      const gen = generateKnockout(seeded, { koTarget: tRow?.ko_target ?? 7, finalTarget: tRow?.final_target ?? 10, startOrder: 1000 });
      await insertGenMatches(admin, tournamentId, gen);
      await admin.from("babyfoot_tournaments").update({ status: "knockout" }).eq("id", tournamentId);
    }
    return;
  }
  if (ms.some((m) => m.phase === "final" && m.status === "finished")) {
    await admin.from("babyfoot_tournaments").update({ status: "finished" }).eq("id", tournamentId);
  }
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();

  let body: { match_id?: string; score_a?: unknown; score_b?: unknown; clear?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const matchId = String(body.match_id ?? "");
  if (!matchId) return NextResponse.json({ error: "match_id requis." }, { status: 400 });

  const { data: m } = await admin
    .from("babyfoot_matches").select("id, tournament_id").eq("id", matchId).maybeSingle();
  if (!m) return NextResponse.json({ error: "Match introuvable." }, { status: 404 });

  // Annulation d'un résultat (remet en 'upcoming').
  if (body.clear) {
    await admin.from("babyfoot_matches").update({ score_a: null, score_b: null, status: "upcoming" }).eq("id", matchId);
    if (m.tournament_id) await recomputeAwards(admin, m.tournament_id);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const a = Number(body.score_a);
  const b = Number(body.score_b);
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a > 10 || b > 10) {
    return NextResponse.json({ error: "Score invalide (0 à 10)." }, { status: 400 });
  }
  if (a === b) return NextResponse.json({ error: "Pas de match nul en baby-foot — il faut un vainqueur." }, { status: 400 });
  const ok = await applyResult(admin, matchId, a, b);
  if (!ok) return NextResponse.json({ error: "Scores invalides." }, { status: 400 });

  if (m.tournament_id) {
    await autoAdvance(admin, m.tournament_id); // génère les demies / clôture si besoin
    await recomputeAwards(admin, m.tournament_id); // APRÈS auto-progression (qualif, podium)
  }
  return NextResponse.json({ ok: true });
}
