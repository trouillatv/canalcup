// Helpers partagés du live show quiz — utilisés par l'API publique
// (/api/quiz/session, qui avance le rythme TOUT SEUL au fil des polls) et l'API
// présentateur (/api/admin/quiz/session : pause/reprise/saut/stop).

import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_COUNTDOWN_MS } from "@/lib/scoring";

type Supa = ReturnType<typeof createAdminClient>;
export const QUIZ_COUNTED_QUESTION_LIMIT = 60;

// started_at posé dans le FUTUR (now + countdown) → compte à rebours visible +
// l'API answer refuse toute réponse avant. Anti-précharge du doigt.
export function futureStartedAt(): string {
  return new Date(Date.now() + QUIZ_COUNTDOWN_MS).toISOString();
}

export async function listQuestionIds(supabase: Supa): Promise<string[]> {
  const { data } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("disabled", false) // exclut les questions retirées du jeu (ex. blagues WAG)
    .order("created_at", { ascending: true });
  return (data ?? []).map((q) => q.id as string);
}

// Banque du jour : on ne retient que les 60 premières questions actives.
// Live et Solo partagent ce même pool pour éviter d'épuiser la banque totale.
export async function dailyQuestionIds(supabase: Supa, limit = 60): Promise<string[]> {
  const ids = await listQuestionIds(supabase);
  return ids.slice(0, Math.max(1, limit));
}

export function isCountedQuizQuestionIndex(questionIndex: number | null | undefined): boolean {
  return typeof questionIndex === "number" && questionIndex >= 0 && questionIndex < QUIZ_COUNTED_QUESTION_LIMIT;
}

export function isCountedQuizQuestionPosition(position: number | null | undefined): boolean {
  return typeof position === "number" && position >= 0 && position < QUIZ_COUNTED_QUESTION_LIMIT;
}

type SessionQuestionSource = { created_at: string | null; question_ids: unknown };

export function countedQuestionIdsFromSessions(
  sessions: SessionQuestionSource[],
  limit = QUIZ_COUNTED_QUESTION_LIMIT
): Set<string> {
  const ordered = [...sessions].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  const counted = new Set<string>();
  for (const session of ordered) {
    const ids = Array.isArray(session.question_ids) ? (session.question_ids as string[]) : [];
    for (const id of ids) {
      if (counted.size >= limit) return counted;
      counted.add(id);
    }
  }
  return counted;
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
  const all = await dailyQuestionIds(supabase);
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

// Toutes les questions déjà RÉPONDUES par n'importe qui (Live OU Solo).
// Indispensable pour le tirage : les questions du mode Solo ne figurent PAS dans
// session.question_ids (le Solo sert le complément), donc usedQuestionIds seul les
// laisse ré-éligibles. Reposer une question déjà répondue = déjà-vu pour le joueur
// ET collision anti-rejeu (la route answer retrouve l'ancienne ligne et l'écrase).
// Lecture PAGINÉE : quiz_answers dépasse vite 1000 lignes (60 questions × joueurs).
export async function answeredQuestionIds(supabase: Supa): Promise<Set<string>> {
  const set = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("quiz_answers").select("question_id").range(from, from + 999);
    if (!data || data.length === 0) break;
    for (const r of data) {
      const id = (r as { question_id: unknown }).question_id;
      if (typeof id === "string") set.add(id);
    }
    if (data.length < 1000) break;
  }
  return set;
}

// Ensemble complet à exclure d'un nouveau tirage / d'une extension :
// questions déjà projetées en Live (toutes sessions) ∪ questions déjà répondues
// (Live + Solo). Garantit qu'un nouveau quiz ne repose JAMAIS du déjà-vu.
export async function consumedQuestionIds(supabase: Supa): Promise<Set<string>> {
  const [used, answered] = await Promise.all([usedQuestionIds(supabase), answeredQuestionIds(supabase)]);
  for (const id of answered) used.add(id);
  return used;
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
