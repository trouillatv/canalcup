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
import { QUIZ_TIMER_SECONDS, QUIZ_TIMEUP_MS, QUIZ_STATS_MS, QUIZ_REVEAL_END_MS } from "@/lib/scoring";
import { advanceQuizSession } from "@/lib/quiz/session";
import { selectAll } from "@/lib/data/select-all";

type Supa = ReturnType<typeof createAdminClient>;

const SESSION_COLS = "id, current_question_id, question_index, started_at, status, paused_at, question_ids";

// Classement individuel du quiz (somme des points + nb de bonnes réponses),
// agrégé depuis quiz_answers (vidé au reset → ne contient que la session courante).
async function computeStandings(
  supabase: Supa
): Promise<{ name: string; points: number; correct: number }[]> {
  // selectAll : paginé (sinon >1000 réponses → classement final tronqué/sous-compté).
  const rows = await selectAll<{ user_id: string; points_awarded: number | null; is_correct: boolean }>(
    supabase,
    "quiz_answers",
    "user_id, points_awarded, is_correct"
  );
  if (!rows.length) return [];
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

  const { data: question } = await supabase
    .from("quiz_questions")
    .select(
      "id, question, answer_a, answer_b, answer_c, answer_d, category, difficulty, correct_answer, explanation"
    )
    .eq("id", session.current_question_id)
    .maybeSingle();

  if (!question) return NextResponse.json({ status: "idle" });

  // Total = taille du sous-ensemble tiré pour CETTE session (fallback : nb total).
  const qIds = session.question_ids as string[] | null | undefined;
  let total = Array.isArray(qIds) ? qIds.length : 0;
  if (!total) {
    const { count } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true });
    total = count ?? 0;
  }

  // Phase = 100 % dérivée du temps. En PAUSE, l'horloge effective est figée à
  // paused_at → l'état (et le chrono) ne bouge plus tant qu'on n'a pas repris.
  const paused = !!session.paused_at;
  const effectiveNow = paused ? new Date(session.paused_at as string).getTime() : Date.now();
  const elapsed = effectiveNow - new Date(session.started_at).getTime();

  // Cycle : countdown → question → timeup → stats (répartition, SANS la bonne
  // réponse : suspense) → answer (bonne réponse + taux). Tout dérivé du temps.
  const Q = QUIZ_TIMER_SECONDS * 1000;
  type Phase = "countdown" | "question" | "timeup" | "stats" | "answer";
  const phase: Phase =
    elapsed < 0
      ? "countdown"
      : elapsed < Q
        ? "question"
        : elapsed < Q + QUIZ_TIMEUP_MS
          ? "timeup"
          : elapsed < Q + QUIZ_TIMEUP_MS + QUIZ_STATS_MS
            ? "stats"
            : "answer";

  // La bonne réponse n'est dévoilée QU'À la phase answer (jamais avant).
  const revealed = phase === "answer";

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
    paused,
    question: safeQuestion,
    started_at: session.started_at,
    question_index: session.question_index ?? 0,
    total: total ?? 0,
  };

  // Phases sans votes (countdown / question / timeup) → question seule.
  if (phase !== "stats" && phase !== "answer") {
    return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });
  }

  // ── Répartition des votes (stats + answer) ─────────────────────────────────
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

  return NextResponse.json(
    {
      ...base,
      distribution,
      responded,
      // answer : on ajoute la bonne réponse + explication (pour le taux de réussite).
      ...(revealed
        ? { correct_answer: question.correct_answer, explanation: question.explanation }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
