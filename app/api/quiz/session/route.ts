// GET /api/quiz/session — état du quiz live (joueurs /quiz-live + écran TV maître
// /quiz-show). Poll ~1s. Pas de session active → status='idle'.
//
// Une session active renvoie status='question' (inchangé pour /admin/quiz) PLUS
// une `phase` dérivée du temps :
//   - countdown : started_at est dans le futur (anti-précharge du doigt)
//   - question  : chrono en cours (≤ QUIZ_TIMER_SECONDS)
//   - reveal    : chrono écoulé → on dévoile la bonne réponse, l'explication et la
//                 répartition des votes A/B/C/D + le % de participants ayant répondu
//
// La phase est CALCULÉE ici (aucune écriture en base, donc pas de course entre
// clients, pas de migration). Anti-triche : correct_answer/explanation ne sont
// JAMAIS renvoyés avant la phase reveal.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_TIMER_SECONDS } from "@/lib/scoring";

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
      .select(
        "id, question, answer_a, answer_b, answer_c, answer_d, category, difficulty, correct_answer, explanation"
      )
      .eq("id", session.current_question_id)
      .maybeSingle(),
    supabase.from("quiz_questions").select("*", { count: "exact", head: true }),
  ]);

  if (!question) return NextResponse.json({ status: "idle" });

  const elapsed = Date.now() - new Date(session.started_at).getTime();
  const phase =
    elapsed < 0 ? "countdown" : elapsed < QUIZ_TIMER_SECONDS * 1000 ? "question" : "reveal";

  // Avant le reveal : on ne renvoie JAMAIS la bonne réponse ni l'explication.
  const safeQuestion = {
    id: question.id,
    question: question.question,
    answer_a: question.answer_a,
    answer_b: question.answer_b,
    answer_c: question.answer_c,
    answer_d: question.answer_d,
    category: question.category,
    difficulty: question.difficulty,
  };

  const base = {
    status: "question" as const,
    phase,
    question: safeQuestion,
    started_at: session.started_at,
    question_index: session.question_index ?? 0,
    total: total ?? 0,
  };

  if (phase !== "reveal") {
    return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });
  }

  // ── Reveal : bonne réponse + explication + répartition des votes ───────────
  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("answer")
    .eq("question_id", question.id);
  const distribution: Record<"A" | "B" | "C" | "D", number> = { A: 0, B: 0, C: 0, D: 0 };
  let responded = 0;
  for (const a of answers ?? []) {
    const key = a.answer as "A" | "B" | "C" | "D";
    if (key === "A" || key === "B" || key === "C" || key === "D") {
      distribution[key] += 1;
      responded += 1;
    }
  }

  // Participants ≈ la salle : chaque téléphone auto-soumet "" au timeout, donc le
  // nombre de user_id distincts sur l'ensemble de la session est un bon proxy.
  const { data: allAnswers } = await supabase.from("quiz_answers").select("user_id");
  const participants = new Set((allAnswers ?? []).map((a) => a.user_id)).size;

  return NextResponse.json(
    {
      ...base,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      distribution,
      responded,
      participants,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
