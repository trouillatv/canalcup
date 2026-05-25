import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePoints } from "@/lib/scoring";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { match_id, predicted_score_a, predicted_score_b } = body;

  if (!match_id || predicted_score_a === undefined || predicted_score_b === undefined) {
    return NextResponse.json({ error: "match_id, predicted_score_a, predicted_score_b requis" }, { status: 400 });
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("users")
    .select("id, team_id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  // Pronos = individuels : on accepte même sans équipe (team_id null). Le prono
  // compte alors au classement individuel, sans créditer d'équipe.

  // Get match to validate timing and maybe calculate points immediately
  const { data: match } = await supabase.from("matches").select("*").eq("id", match_id).single();
  if (!match) return NextResponse.json({ error: "Match introuvable" }, { status: 404 });

  // Block prediction if match already started
  if (new Date(match.starts_at) <= new Date()) {
    return NextResponse.json({ error: "Match déjà commencé" }, { status: 400 });
  }

  const scoreA = parseInt(predicted_score_a, 10);
  const scoreB = parseInt(predicted_score_b, 10);

  // Derive result from scores
  const prediction_result = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "DRAW";

  // Points will be 0 until match is finished (calculated by cron)
  let points_awarded = 0;
  if (match.status === "finished") {
    points_awarded = calculatePoints(match, scoreA, scoreB);
  }

  // Upsert prediction (one prediction per user per match)
  const { data, error } = await supabase
    .from("predictions")
    .upsert(
      {
        user_id: profile.id,
        team_id: profile.team_id ?? null,
        match_id,
        prediction_result,
        predicted_score_a: scoreA,
        predicted_score_b: scoreB,
        points_awarded,
      },
      { onConflict: "user_id,match_id" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prediction: data });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ predictions: [] });

  const { data: predictions } = await supabase
    .from("predictions")
    .select("*")
    .eq("user_id", profile.id);

  return NextResponse.json({ predictions: predictions ?? [] });
}
