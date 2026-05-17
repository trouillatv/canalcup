// POST /api/admin/generate-story?id=UUID  → génère ou re-génère la story d'un match terminé
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMatchStory } from "@/services/ai/generators/match-story";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("id");
  if (!matchId) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const supabase = createAdminClient();

  // Fetch match data
  const { data: match } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, score_a, score_b, phase, status")
    .eq("id", matchId)
    .single();

  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  if (match.status !== "finished") return NextResponse.json({ error: "Match non terminé" }, { status: 400 });
  if (match.score_a === null || match.score_b === null) return NextResponse.json({ error: "Score manquant" }, { status: 400 });

  // Delete existing story to force regeneration
  await supabase.from("match_stories").delete().eq("match_id", matchId);

  await generateMatchStory({
    matchId,
    teamA: match.team_a,
    flagA: match.flag_a ?? "",
    teamB: match.team_b,
    flagB: match.flag_b ?? "",
    scoreA: match.score_a,
    scoreB: match.score_b,
    phase: match.phase ?? "Groupe",
  });

  const { data: story } = await supabase
    .from("match_stories")
    .select("phrase")
    .eq("match_id", matchId)
    .single();

  return NextResponse.json({ ok: true, match_id: matchId, phrase: story?.phrase });
}
