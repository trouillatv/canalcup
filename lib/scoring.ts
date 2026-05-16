// Scoring engine for Canal Cup predictions
// Rules: exact score > correct result > correct goal diff > 0

import type { Match } from "@/lib/supabase/types";

const PHASE_MULTIPLIERS: Record<string, number> = {
  "Group Stage": 1,
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

// Recalculate and update points for all predictions on a finished match
// Called by the cron after match finishes
export function scoreLabel(points: number): string {
  if (points >= 10) return "Score exact 🎯";
  if (points >= 5) return "Bon résultat ✅";
  if (points >= 3) return "Bonne différence ↔";
  return "Raté ❌";
}
