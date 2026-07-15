// GET /api/quiz/solo — état du mode SOLO pour le joueur courant.
//
// Le Solo propose les questions NON posées pendant le Live (complément du tirage)
// jouables individuellement APRÈS le Live. Le joueur enchaîne les questions à son
// rythme (chrono normal côté client), score réduit (cf. quizSoloPoints).
// Anti-rejeu : une question déjà répondue (Live OU Solo) ne se rejoue pas.
// On ne renvoie JAMAIS la bonne réponse ici.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_SOLO_COEFFICIENT } from "@/lib/scoring";
import { getSoloWindow } from "@/lib/quiz/solo";
import { dailyQuestionIds } from "@/lib/quiz/session";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ available: false, reason: "auth" }, { status: 401 });

  const admin = createAdminClient();

  // Verrou Solo : ouvert UNIQUEMENT après la fin du Live et dans la fenêtre
  // temporelle (cf. getSoloWindow).
  const win = await getSoloWindow(admin);
  if (!win.available || !win.session) {
    return NextResponse.json({ available: false, reason: win.reason, closesAt: win.closesAt });
  }
  const session = win.session;

  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ available: false, reason: "profile" }, { status: 404 });

  const [{ data: allQuestions }, { data: mine }, { data: sessRow }] = await Promise.all([
    admin
      .from("quiz_questions")
      .select("id, question, answer_a, answer_b, answer_c, answer_d, category, difficulty")
      .eq("disabled", false) // exclut les questions retirées du jeu (ex. blagues WAG)
      .order("created_at", { ascending: true }),
    admin.from("quiz_answers").select("question_id").eq("user_id", profile.id),
    admin.from("quiz_session").select("question_ids").eq("id", session.id).maybeSingle(),
  ]);

  // Le Solo utilise le même pool quotidien que le Live : les 60 premières
  // questions actives. Pas de différence de banque entre les deux modes.
  const dailyIds = await dailyQuestionIds(admin, 60);
  const liveSet = new Set((sessRow?.question_ids as string[] | null) ?? dailyIds);
  const questions = (allQuestions ?? []).filter((q) => liveSet.has(q.id) && dailyIds.includes(q.id));

  const answered = [...new Set((mine ?? []).map((a) => a.question_id as string))];

  return NextResponse.json(
    {
      available: true,
      session_id: session.id,
      coefficient: QUIZ_SOLO_COEFFICIENT,
      closesAt: win.closesAt,
      questions: questions ?? [],
      answered,
      scoring_note:
        "Le mode Solo est ouvert à tout le monde. Les questions déjà jouées ou déjà répondues ne rapportent plus de points.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
