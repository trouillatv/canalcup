// Plafond de scoring du quiz — logique PURE (sans dépendance Supabase/Next) pour
// être testable en isolation (voir counted.test.ts).
//
// Règle : le championnat se joue « en CUMUL sur les 2 quiz ». Chaque quiz
// comptabilise ses 60 PREMIÈRES questions DISTINCTES indépendamment — ce n'est
// PAS un budget global partagé entre les sessions. Un budget global unique
// laissait Quiz #1 (déjà 60 questions) tout consommer → Quiz #2 comptait 0
// (classement du dernier quiz vidé, points du 2e quiz annulés).

export const QUIZ_COUNTED_QUESTION_LIMIT = 60;

export function isCountedQuizQuestionIndex(questionIndex: number | null | undefined): boolean {
  return typeof questionIndex === "number" && questionIndex >= 0 && questionIndex < QUIZ_COUNTED_QUESTION_LIMIT;
}

export function isCountedQuizQuestionPosition(position: number | null | undefined): boolean {
  return typeof position === "number" && position >= 0 && position < QUIZ_COUNTED_QUESTION_LIMIT;
}

export type SessionQuestionSource = { created_at: string | null; question_ids: unknown };

// Ensemble des question_ids qui rapportent des points. On plafonne PAR session à
// ses `limit` premières questions DISTINCTES (slice sur la liste ordonnée de la
// session, puis Set) : l'ordre des lignes de réponse et les éventuels doublons
// n'influencent pas le comptage — un même identifiant de question ne consomme
// qu'un seul créneau, identique pour tous les joueurs.
export function countedQuestionIdsFromSessions(
  sessions: SessionQuestionSource[],
  limit = QUIZ_COUNTED_QUESTION_LIMIT
): Set<string> {
  const counted = new Set<string>();
  for (const session of sessions) {
    const ids = Array.isArray(session.question_ids) ? (session.question_ids as string[]) : [];
    // Créneaux comptés = 60 questions DISTINCTES de CETTE session. On déduplique
    // d'abord, PUIS on tronque, pour qu'un doublon en tête ne « vole » pas un
    // créneau à une 60e question légitime.
    const distinct = [...new Set(ids)].slice(0, limit);
    for (const id of distinct) counted.add(id);
  }
  return counted;
}
