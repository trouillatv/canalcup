// GET /api/quiz/session — état du quiz live pour les joueurs.
// Poll régulier (toutes ~2s) côté /quiz-live. Pas de session active
// → status='idle'. Sinon : la question courante + started_at +
// l'index / le total pour afficher "Question N / M".
//
// NB : on ne renvoie JAMAIS correct_answer côté joueur.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("quiz_session")
    .select("id, current_question_id, question_index, started_at, status")
    .is("ended_at", null)
    .maybeSingle();

  if (!session || session.status !== "question" || !session.current_question_id) {
    return NextResponse.json({ status: "idle" });
  }

  const [{ data: question }, { count: total }] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select("id, question, answer_a, answer_b, answer_c, answer_d, category, difficulty")
      .eq("id", session.current_question_id)
      .maybeSingle(),
    supabase
      .from("quiz_questions")
      .select("*", { count: "exact", head: true }),
  ]);

  if (!question) return NextResponse.json({ status: "idle" });

  return NextResponse.json({
    status: "question",
    question,
    started_at: session.started_at,
    question_index: session.question_index ?? 0,
    total: total ?? 0,
  });
}
