// GET /api/predictions/history — all user predictions enriched with match data
// Returns only finished matches to show actual results

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ history: [] });

  const { data: predictions } = await supabase
    .from("predictions")
    .select(`
      id,
      match_id,
      predicted_score_a,
      predicted_score_b,
      prediction_result,
      points_awarded,
      created_at,
      match:matches(id, team_a, team_b, flag_a, flag_b, score_a, score_b, status, starts_at, phase, stage, is_settled)
    `)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  // Compute summary stats
  const all = predictions ?? [];
  const finished = all.filter((p) => (p.match as { status: string })?.status === "finished");
  const totalPts = finished.reduce((s, p) => s + (p.points_awarded ?? 0), 0);
  const exactScores = finished.filter((p) => {
    const m = p.match as { score_a: number; score_b: number } | null;
    return m && p.predicted_score_a === m.score_a && p.predicted_score_b === m.score_b;
  }).length;
  const correctResults = finished.filter((p) => (p.points_awarded ?? 0) >= 5 && (p.points_awarded ?? 0) < 10).length;
  const pending = all.filter((p) => (p.match as { status: string })?.status === "upcoming").length;

  return NextResponse.json({
    history: all,
    stats: {
      total_predictions: all.length,
      finished_matches: finished.length,
      pending,
      total_points: totalPts,
      exact_scores: exactScores,
      correct_results: correctResults,
    },
  });
}
