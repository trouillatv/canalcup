// GET /api/quiz/solo — état du mode SOLO pour le joueur courant.
//
// Le Solo rend « le même quiz » jouable individuellement APRÈS le lancement
// officiel (started_at de la session la plus récente passé). Le joueur enchaîne
// les questions à son rythme (chrono normal côté client), score réduit
// (cf. quizSoloPoints). Anti-rejeu : une question déjà répondue (Live OU Solo)
// ne se rejoue pas. On ne renvoie JAMAIS la bonne réponse ici.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_SOLO_COEFFICIENT } from "@/lib/scoring";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false, reason: "auth" }, { status: 401 });

  const admin = createAdminClient();

  // Session quiz la plus récente : le Solo s'ouvre dès qu'un quiz a été LANCÉ
  // (session créée). On ne se base PAS sur started_at, qui repart dans le futur
  // à chaque countdown de question en Live (sinon le Solo clignoterait).
  const { data: session } = await admin
    .from("quiz_session")
    .select("id, status, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ available: false, reason: "not_launched" });
  }

  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ available: false, reason: "profile" }, { status: 404 });

  const [{ data: questions }, { data: mine }] = await Promise.all([
    admin
      .from("quiz_questions")
      .select("id, question, answer_a, answer_b, answer_c, answer_d, category, difficulty")
      .order("created_at", { ascending: true }),
    admin.from("quiz_answers").select("question_id").eq("user_id", profile.id),
  ]);

  const answered = [...new Set((mine ?? []).map((a) => a.question_id as string))];

  return NextResponse.json(
    {
      available: true,
      session_id: session.id,
      coefficient: QUIZ_SOLO_COEFFICIENT,
      questions: questions ?? [],
      answered,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
