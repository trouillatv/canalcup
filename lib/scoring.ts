// Scoring engine for Canal Cup predictions
// Rules: exact score > correct result > correct goal diff > 0

import type { Match } from "@/lib/supabase/types";

const PHASE_MULTIPLIERS: Record<string, number> = {
  // French (stored in DB)
  "Groupe": 1,
  "Seizièmes": 1.25,
  "Huitièmes": 1.5,
  "Quarts": 2,
  "Demis": 2.5,
  "3ème place": 2,
  "Finale": 3,
  // English fallbacks (TheSportsDB raw values)
  "Group Stage": 1,
  "Round of 32": 1.25,
  "Round of 16": 1.5,
  "Quarter-final": 2,
  "Semi-final": 2.5,
  "3rd Place": 2,
  "Final": 3,
};

export type MatchResult = "A" | "DRAW" | "B";

export function getResult(scoreA: number, scoreB: number): MatchResult {
  if (scoreA > scoreB) return "A";
  if (scoreB > scoreA) return "B";
  return "DRAW";
}

export function getMultiplier(phase: string | null | undefined): number {
  return PHASE_MULTIPLIERS[phase ?? "Group Stage"] ?? 1;
}

export function calculatePoints(
  match: Match,
  predictedScoreA: number,
  predictedScoreB: number
): number {
  const actualA = match.score_a ?? null;
  const actualB = match.score_b ?? null;

  if (actualA === null || actualB === null) return 0;

  const multiplier = getMultiplier(match.phase);

  // Exact score
  if (predictedScoreA === actualA && predictedScoreB === actualB) {
    return Math.round(10 * multiplier);
  }

  const actualResult = getResult(actualA, actualB);
  const predictedResult = getResult(predictedScoreA, predictedScoreB);
  const actualDiff = actualA - actualB;
  const predictedDiff = predictedScoreA - predictedScoreB;

  // Correct result
  if (actualResult === predictedResult) {
    return Math.round(5 * multiplier);
  }

  // Correct goal difference (wrong result)
  if (actualDiff === predictedDiff) {
    return Math.round(3 * multiplier);
  }

  return 0;
}

// Issue d'un pronostic — MÊME logique que calculatePoints (ordre des tiers
// identique), pour la heatmap. NB : "correct_diff" est en pratique inatteignable
// (une différence de buts égale implique le même résultat → capté par
// correct_result), mais on le garde par fidélité au barème.
export type PredictionOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";

export function getPredictionOutcome(
  pred: { predicted_score_a: number | null; predicted_score_b: number | null },
  match: { status?: string | null; score_a: number | null; score_b: number | null } | null | undefined
): PredictionOutcome {
  const pa = pred.predicted_score_a;
  const pb = pred.predicted_score_b;
  if (!match || match.score_a == null || match.score_b == null) return "pending";
  if (match.status && match.status !== "finished") return "pending";
  if (pa == null || pb == null) return "pending";
  const aa = match.score_a;
  const ab = match.score_b;
  if (pa === aa && pb === ab) return "exact";
  if (getResult(pa, pb) === getResult(aa, ab)) return "correct_result";
  if (pa - pb === aa - ab) return "correct_diff";
  return "wrong";
}

// Quiz Live — barème : +5 si bonne réponse en moins de 5s, +3 sinon,
// 0 si fausse réponse ou timeout. Source unique partagée client + serveur.
// 20s par question (passé de 15 → 20 pour le live show, mai 2026).
export const QUIZ_TIMER_SECONDS = 20;
export const QUIZ_FAST_THRESHOLD_MS = 5000;

// Anti-triche / anti-précharge
// QUIZ_COUNTDOWN_MS : à chaque start/next, started_at est fixé dans le futur
// (now + countdown). Le client affiche "3… 2… 1…" et désactive les boutons
// pendant ce délai. Empêche d'avoir le doigt préchargé sur une lettre.
// QUIZ_MIN_RESPONSE_MS : sous ce seuil après started_at, le serveur refuse
// la réponse. Filet anti-bot / anti-clic instantané (un humain ne peut pas
// lire une question + cliquer en < 250ms).
export const QUIZ_COUNTDOWN_MS = 3000;
export const QUIZ_MIN_RESPONSE_MS = 250;

export function quizPoints(isCorrect: boolean, responseTimeMs: number): number {
  if (!isCorrect) return 0;
  return responseTimeMs <= QUIZ_FAST_THRESHOLD_MS ? 5 : 3;
}

// Recalculate and update points for all predictions on a finished match
// Called by the cron after match finishes
export function scoreLabel(points: number): string {
  if (points >= 10) return "Score exact 🎯";
  if (points >= 5) return "Bon résultat ✅";
  if (points >= 3) return "Bonne différence ↔";
  return "Raté ❌";
}
