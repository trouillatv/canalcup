// Scorers V1 — faits déterministes, sans barème (voir
// docs/adr/0005-prediction-engine-market-types.md, section 4). Séparation
// stricte faits/points : ces fonctions ne calculent jamais de points,
// n'accèdent jamais à la base, et fonctionnent identiquement que
// `scoring_rules` contienne 0 ligne ou plusieurs — le barème reste un HARD
// STOP produit séparé, non traité ici.

import type { ExactScorePayload } from "./contracts.ts";

export type EventResult = { home_score: number; away_score: number };

export class UnknownScorerError extends Error {
  constructor(scorerKey: string) {
    super(`No scorer registered for scorer_key "${scorerKey}"`);
    this.name = "UnknownScorerError";
  }
}

type Outcome = "home" | "draw" | "away";

function outcomeOf(result: EventResult): Outcome {
  if (result.home_score === result.away_score) return "draw";
  return result.home_score > result.away_score ? "home" : "away";
}

export type ExactScoreFacts = { exact: boolean; correct_outcome: boolean; correct_diff: boolean };

export function computeExactScoreFacts(
  payload: ExactScorePayload,
  result: EventResult
): ExactScoreFacts {
  const predictedOutcome = outcomeOf({ home_score: payload.home, away_score: payload.away });
  const actualOutcome = outcomeOf(result);
  return {
    exact: payload.home === result.home_score && payload.away === result.away_score,
    correct_outcome: predictedOutcome === actualOutcome,
    correct_diff: payload.home - payload.away === result.home_score - result.away_score,
  };
}

type Scorer = (payload: any, result: EventResult) => Record<string, boolean>;

const SCORERS: Record<string, Scorer> = {
  "exact_score.v1": computeExactScoreFacts as Scorer,
};

// Fail-closed, même logique que getValidator() (ADR 0005 section 3/4) :
// un scorer_key sans implémentation enregistrée lève une exception
// explicite plutôt que de laisser une prediction passer à `settled` sans
// faits calculés.
export function getScorer(scorerKey: string): Scorer {
  const scorer = SCORERS[scorerKey];
  if (!scorer) throw new UnknownScorerError(scorerKey);
  return scorer;
}
