// GET /api/quiz/player-detail?user_id=... — audit d'UN joueur (anti-contestation).
//
// Confidentialité :
//   - RÉSUMÉ (bonnes/mauvaises/non répondues, +5/+3, temps moyen, points réels +
//     points pondérés au général) → PUBLIC (visible pour tout le monde).
//   - DÉTAIL question par question (réponses + bonnes réponses) → réservé au
//     joueur lui-même OU à un admin. Les autres ne voient QUE le résumé.
//   - Le détail n'est visible qu'APRÈS le quiz : pendant un Live actif, on ne
//     dévoile pas les bonnes réponses (anti-triche) — sauf pour l'admin.
//
// Aucun recalcul : mêmes chiffres que l'export CSV (source commune buildQuizAudit).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { buildQuizAudit } from "@/lib/quiz/audit";
import { QUIZ_CHAMPIONSHIP, isQualifClosed, isFinalsExcluded } from "@/lib/config/quiz-championship";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetId = new URL(req.url).searchParams.get("user_id");
  if (!targetId) return NextResponse.json({ error: "user_id requis" }, { status: 400 });

  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
  const viewerIsAdmin = await isAdminRequest(req);
  const isSelf = me?.id === targetId;

  // Un Live est-il en cours ? (le détail des réponses reste caché pendant le quiz)
  const admin = createAdminClient();
  const { data: liveSession } = await admin
    .from("quiz_session")
    .select("status")
    .is("ended_at", null)
    .maybeSingle();
  const liveActive = liveSession?.status === "question";

  const audit = await buildQuizAudit(targetId);
  const summary = audit.summaries[0] ?? null;
  if (!summary) {
    return NextResponse.json(
      { player: null, summary: null, questions: [], canSeeDetail: false, restrictedReason: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  // Détail visible si : admin (toujours) OU (c'est moi ET aucun Live en cours).
  const canSeeDetail = viewerIsAdmin || (isSelf && !liveActive);
  const restrictedReason = canSeeDetail
    ? null
    : !isSelf
      ? "other_player" // résumé public seulement
      : "quiz_live"; // moi, mais quiz en cours → après la fin

  const finalists = QUIZ_CHAMPIONSHIP.finalists;
  const { data: targetUser } = await admin.from("users").select("email").eq("id", targetId).maybeSingle();
  const horsConcours = isFinalsExcluded(targetUser?.email);
  const qualified =
    QUIZ_CHAMPIONSHIP.finale.enabled && !horsConcours && summary.quiz_rank != null && summary.quiz_rank <= finalists;

  return NextResponse.json(
    {
      player: {
        user_id: summary.user_id,
        display_name: summary.display_name,
        team_name: summary.team_name,
      },
      summary,
      qualified,
      horsConcours,
      finalists,
      qualifClosed: isQualifClosed(),
      questions: canSeeDetail ? audit.answers : [],
      canSeeDetail,
      restrictedReason,
      viewerIsAdmin,
      isSelf,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
