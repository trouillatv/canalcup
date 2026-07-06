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

// Tire `count` ids de questions AU HASARD (ordre aléatoire). Sert au démarrage
// d'une session : on ne pose pas toutes les questions, mais un sous-ensemble.
// `exclude` (ex. les questions des quiz précédents) est évité en priorité — pas
// de répétition d'un quiz à l'autre, et surtout pas de collision anti-rejeu
// (reposer une question déjà répondue écraserait l'ancienne réponse). Si tout
// est exclu, garde-fou : on retombe sur l'ensemble complet.
export async function pickRandomQuestionIds(
  supabase: Supa,
  count: number,
  exclude?: Set<string>
): Promise<string[]> {
  const all = await listQuestionIds(supabase);
  const filtered = exclude && exclude.size ? all.filter((id) => !exclude.has(id)) : all;
  const pool = filtered.length ? filtered : all;
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.max(1, Math.min(count, pool.length)));
}

// Toutes les questions déjà utilisées dans des sessions passées (union des
// question_ids) → à exclure du tirage d'un nouveau quiz.
export async function usedQuestionIds(supabase: Supa): Promise<Set<string>> {
  const { data } = await supabase.from("quiz_session").select("question_ids");
  const set = new Set<string>();
  for (const s of data ?? []) {
    const ids = (s as { question_ids: unknown }).question_ids;
    if (Array.isArray(ids)) for (const id of ids) set.add(id as string);
  }
  return set;
}

// La liste de passage d'une session = sa colonne question_ids (sous-ensemble
// tiré au start). Fallback : toutes les questions (anciennes sessions sans set).
export async function sessionQuestionIds(supabase: Supa, sessionId: string): Promise<string[]> {
  const { data } = await supabase
    .from("quiz_session")
    .select("question_ids")
    .eq("id", sessionId)
    .maybeSingle();
  const ids = data?.question_ids as string[] | null | undefined;
  return Array.isArray(ids) && ids.length ? ids : await listQuestionIds(supabase);
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
  const ids = await sessionQuestionIds(supabase, sessionId);
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
