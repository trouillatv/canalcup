import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculatePoints } from "@/lib/scoring";
import { isRedCardBlocked, hasVarWindow, modificationLock } from "@/lib/jokers/gating";

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

  // ── Jokers : gating ────────────────────────────────────────────────────────
  // 🚫 Carton Rouge : suspension totale sur ce match.
  if (await isRedCardBlocked(profile.id, match_id)) {
    return NextResponse.json(
      { error: "🚫 Carton Rouge : vous êtes suspendu pour ce match." },
      { status: 403 }
    );
  }

  // Prono déjà existant ? (création vs modification — pour Brouillard / Retard)
  const { data: existingPred } = await supabase
    .from("predictions")
    .select("id")
    .eq("user_id", profile.id)
    .eq("match_id", match_id)
    .maybeSingle();
  const isModification = !!existingPred;

  // 🌫 Brouillard / ✈️ Retard : la MODIFICATION d'un prono existant est bloquée
  // (la création d'un prono manquant reste autorisée).
  if (isModification) {
    const lock = await modificationLock(profile.id);
    if (lock) return NextResponse.json({ error: lock }, { status: 403 });
  }

  // 🎥 VAR : fenêtre de modif étendue jusqu'à la mi-temps (1re période + pause).
  // Inclut le statut "halftime" et borne la 2e période via la minute (≤ 45).
  const varActive = await hasVarWindow(profile.id, match_id);
  const inVarWindow =
    !match.is_settled && match.status !== "finished" &&
    (match.status === "upcoming" ||
      match.status === "halftime" ||
      (match.status === "live" && (match.minute == null || match.minute <= 45)));
  const varModifiable = varActive && inVarWindow;

  if (!varModifiable) {
    if (match.status === "live" || match.status === "halftime" || match.status === "finished" || match.is_settled) {
      return NextResponse.json({ error: "Pronostic verrouille : le match a deja commence." }, { status: 400 });
    }
    // Block prediction if match already started
    if (new Date(match.starts_at) <= new Date()) {
      return NextResponse.json({ error: "Match déjà commencé" }, { status: 400 });
    }
  }

  const scoreA = parseInt(predicted_score_a, 10);
  const scoreB = parseInt(predicted_score_b, 10);
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 20 || scoreB > 20) {
    return NextResponse.json({ error: "Scores invalides" }, { status: 400 });
  }

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
