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

type Supa = ReturnType<typeof createAdminClient>;

// Classement individuel du quiz (somme des points + nb de bonnes réponses),
// agrégé depuis quiz_answers (vidé au reset → ne contient que la session courante).
async function computeStandings(
  supabase: Supa
): Promise<{ name: string; points: number; correct: number }[]> {
  const { data: rows } = await supabase
    .from("quiz_answers")
    .select("user_id, points_awarded, is_correct");
  if (!rows?.length) return [];
  const byUser = new Map<string, { points: number; correct: number }>();
  for (const r of rows) {
    const e = byUser.get(r.user_id) ?? { points: 0, correct: 0 };
    e.points += r.points_awarded ?? 0;
    if (r.is_correct) e.correct += 1;
    byUser.set(r.user_id, e);
  }
  const ids = [...byUser.keys()];
  const { data: users } = await supabase
    .from("users")
    .select("id, display_name, name")
    .in("id", ids);
  const nameById = new Map(
    (users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"])
  );
  return [...byUser.entries()]
    .map(([uid, e]) => ({ name: nameById.get(uid) ?? "Joueur", points: e.points, correct: e.correct }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct);
}

export async function GET() {
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("quiz_session")
    .select("id, current_question_id, question_index, started_at, status")
    .is("ended_at", null)
    .maybeSingle();

  if (!session || session.status !== "question" || !session.current_question_id) {
    // Pas de session active : si la DERNIÈRE session est terminée et qu'il reste
    // des réponses, on renvoie le classement final → l'écran TV joue la cérémonie.
    const { data: last } = await supabase
      .from("quiz_session")
      .select("id, status")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last?.status === "finished") {
      const standings = await computeStandings(supabase);
      if (standings.length) {
        return NextResponse.json(
          { status: "finished", standings },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }
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
  // ⚠️ Approximation connue : un joueur qui rejoint sans avoir encore répondu
  // n'est pas compté (pas de présence/roster en V1).
  const { data: allAnswers } = await supabase.from("quiz_answers").select("user_id");
  const participants = new Set((allAnswers ?? []).map((a) => a.user_id)).size;

  // ⚡ Le plus rapide = bonne réponse au temps le plus court sur cette question.
  const { data: fastRows } = await supabase
    .from("quiz_answers")
    .select("user_id, response_time_ms")
    .eq("question_id", question.id)
    .eq("is_correct", true)
    .order("response_time_ms", { ascending: true })
    .limit(1);
  let fastest: { name: string; ms: number } | null = null;
  if (fastRows && fastRows.length) {
    const { data: u } = await supabase
      .from("users")
      .select("display_name, name")
      .eq("id", fastRows[0].user_id)
      .maybeSingle();
    fastest = {
      name: u?.display_name?.trim() || u?.name?.trim() || "Un joueur",
      ms: fastRows[0].response_time_ms ?? 0,
    };
  }

  return NextResponse.json(
    {
      ...base,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
      distribution,
      responded,
      participants,
      fastest,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
