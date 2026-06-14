import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { WC_START_MS } from "@/lib/tournament";

// Pronostics "winner" et "top_scorer" fermés au coup d'envoi du tournoi.
const LOCKED_TYPES = new Set(["winner", "top_scorer"]);

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ predictions: [] });

  const { data: predictions } = await supabase
    .from("bonus_predictions")
    .select("*")
    .eq("user_id", profile.id);

  return NextResponse.json({ predictions: predictions ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { prediction_type, predicted_value } = await req.json();
  if (!prediction_type || !predicted_value) {
    return NextResponse.json({ error: "prediction_type et predicted_value requis" }, { status: 400 });
  }
  if (LOCKED_TYPES.has(prediction_type) && Date.now() >= WC_START_MS) {
    return NextResponse.json({ error: "Les pronostics du tournoi sont fermés depuis le début de la Coupe du Monde." }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, team_id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  // Bonus de prono = individuels : acceptés même sans équipe (team_id null).

  const { data, error } = await supabase
    .from("bonus_predictions")
    .upsert(
      { user_id: profile.id, team_id: profile.team_id ?? null, prediction_type, predicted_value, points_awarded: 0 },
      { onConflict: "user_id,prediction_type" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ prediction: data });
}
