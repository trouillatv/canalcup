// Helpers partagés du live show quiz — utilisés par l'API publique
// (/api/quiz/session, qui avance le rythme TOUT SEUL au fil des polls) et l'API
// présentateur (/api/admin/quiz/session : pause/reprise/saut/stop).

import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_COUNTDOWN_MS } from "@/lib/scoring";

type Supa = ReturnType<typeof createAdminClient>;

// started_at posé dans le FUTUR (now + countdown) → compte à rebours visible +
// l'API answer refuse toute réponse avant. Anti-précharge du doigt.
export function futureStartedAt(): string {
  return new Date(Date.now() + QUIZ_COUNTDOWN_MS).toISOString();
}

export async function listQuestionIds(supabase: Supa): Promise<string[]> {
  const { data } = await supabase
    .from("quiz_questions")
    .select("id")
    .order("created_at", { ascending: true });
  return (data ?? []).map((q) => q.id as string);
}

// Passe à la question suivante (ou termine le quiz). Idempotent sous appels
// CONCURRENTS : l'UPDATE est gardé sur la question qu'on quitte, donc si deux
// clients déclenchent l'avancement auto en même temps, seul le premier écrit —
// le second ne touche aucune ligne. C'est ce qui rend l'auto-avance sûre.
export async function advanceQuizSession(
  supabase: Supa,
  sessionId: string,
  currentIndex: number,
  currentQuestionId: string | null
): Promise<{ finished: boolean; total: number }> {
  const ids = await listQuestionIds(supabase);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= ids.length) {
    await supabase
      .from("quiz_session")
      .update({
        ended_at: new Date().toISOString(),
        status: "finished",
        current_question_id: null,
        paused_at: null,
      })
      .eq("id", sessionId)
      .is("ended_at", null); // garde : on ne termine qu'une fois
    return { finished: true, total: ids.length };
  }

  let q = supabase
    .from("quiz_session")
    .update({
      current_question_id: ids[nextIndex],
      question_index: nextIndex,
      started_at: futureStartedAt(),
      status: "question",
      stage: "question",
      paused_at: null,
    })
    .eq("id", sessionId);
  // Garde anti-concurrence : on n'avance que depuis la question courante.
  if (currentQuestionId) q = q.eq("current_question_id", currentQuestionId);
  await q;
  return { finished: false, total: ids.length };
}
