// GET /api/quiz/session — état du quiz live (joueurs /quiz-live + écran TV maître
// /quiz-show + télécommande /quiz-control). Poll ~1s. Pas de session active →
// status='idle'.
//
// RYTHME AUTO : il n'y a plus de clic « question suivante ». Le déroulé d'une
// question est entièrement DÉRIVÉ DU TEMPS (started_at, serveur, sans dérive) :
//
//   countdown : started_at dans le futur (anti-précharge du doigt)
//   question  : chrono en cours (≤ QUIZ_TIMER_SECONDS) — réponses ouvertes
//   timeup    : « ⏱ Temps écoulé » bref, réponses grisées
//   answer    : bonne réponse + courte explication
//   → puis, quand le cycle est fini, le serveur enchaîne TOUT SEUL : le premier
//     poll qui constate la fin du cycle avance la session (UPDATE gardé, donc
//     idempotent même si plusieurs clients pollent en même temps).
//
// PAUSE : si paused_at est posé, on FIGE l'état à cet instant et l'auto-avance
// est suspendue (l'organisateur a appuyé sur ⏸). Le « Reprendre » décale
// started_at de la durée de pause (cf. /api/admin/quiz/session).
//
// Anti-triche : correct_answer/explanation ne sont JAMAIS renvoyés tant que le
// chrono n'est pas écoulé (phases countdown/question). Plus aucune statistique
// par question (répartition, plus rapide, classement) : tout est regroupé dans
// le grand reveal de fin.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_TIMER_SECONDS, QUIZ_TIMEUP_MS, QUIZ_REVEAL_END_MS } from "@/lib/scoring";
import { advanceQuizSession } from "@/lib/quiz/session";

type Supa = ReturnType<typeof createAdminClient>;

const SESSION_COLS = "id, current_question_id, question_index, started_at, status, paused_at";

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

  let { data: session } = await supabase
    .from("quiz_session")
    .select(SESSION_COLS)
    .is("ended_at", null)
    .maybeSingle();

  // ── Auto-avance (cœur du rythme auto) ──────────────────────────────────────
  // Si le cycle de la question courante est entièrement écoulé ET qu'on n'est
  // pas en pause, on enchaîne (question suivante ou fin). Déclenché par le simple
  // fait de poller : la TV, les téléphones et la télécommande pollent ~1s, donc
  // ça avance dans la seconde. UPDATE gardé → pas de course entre clients.
  if (session && session.status === "question" && session.current_question_id && !session.paused_at) {
    const elapsed = Date.now() - new Date(session.started_at).getTime();
    if (elapsed >= QUIZ_REVEAL_END_MS) {
      await advanceQuizSession(supabase, session.id, session.question_index ?? 0, session.current_question_id);
      const { data: refreshed } = await supabase
        .from("quiz_session")
        .select(SESSION_COLS)
        .is("ended_at", null)
        .maybeSingle();
      session = refreshed ?? null;
    }
  }

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

  // Phase = 100 % dérivée du temps. En PAUSE, l'horloge effective est figée à
  // paused_at → l'état (et le chrono) ne bouge plus tant qu'on n'a pas repris.
  const paused = !!session.paused_at;
  const effectiveNow = paused ? new Date(session.paused_at as string).getTime() : Date.now();
  const elapsed = effectiveNow - new Date(session.started_at).getTime();

  type Phase = "countdown" | "question" | "timeup" | "answer";
  const phase: Phase =
    elapsed < 0
      ? "countdown"
      : elapsed < QUIZ_TIMER_SECONDS * 1000
        ? "question"
        : elapsed < QUIZ_TIMER_SECONDS * 1000 + QUIZ_TIMEUP_MS
          ? "timeup"
          : "answer";

  // On ne renvoie JAMAIS la bonne réponse avant que le chrono soit écoulé.
  const revealed = phase === "timeup" || phase === "answer";

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

  return NextResponse.json(
    {
      status: "question" as const,
      phase,
      paused,
      question: safeQuestion,
      started_at: session.started_at,
      question_index: session.question_index ?? 0,
      total: total ?? 0,
      ...(revealed
        ? { correct_answer: question.correct_answer, explanation: question.explanation }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
