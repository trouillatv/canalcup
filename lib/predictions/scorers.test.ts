// Tests unitaires — computeFacts() des deux scorers V1 (voir
// docs/adr/0005-prediction-engine-market-types.md, section 4 et 7,
// checklist Round 2 point 7). Purement structurels : ces fonctions sont
// pures (aucun accès DB), donc valides que `scoring_rules` contienne 0
// ligne ou plusieurs — aucun point n'est calculé ni supposé ici.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeExactScoreFacts,
  getScorer,
  UnknownScorerError,
} from "./scorers.ts";

test("exact_score: score exact -> tous les faits vrais", () => {
  const facts = computeExactScoreFacts({ home: 2, away: 1 }, { home_score: 2, away_score: 1 });
  assert.deepEqual(facts, { exact: true, correct_outcome: true, correct_diff: true });
});

test("exact_score: résultat correct mais score inexact", () => {
  const facts = computeExactScoreFacts({ home: 3, away: 2 }, { home_score: 2, away_score: 1 });
  assert.deepEqual(facts, { exact: false, correct_outcome: true, correct_diff: true });
});

test("exact_score: issue correcte mais écart différent", () => {
  const facts = computeExactScoreFacts({ home: 1, away: 0 }, { home_score: 3, away_score: 0 });
  assert.deepEqual(facts, { exact: false, correct_outcome: true, correct_diff: false });
});

test("exact_score: tout faux", () => {
  const facts = computeExactScoreFacts({ home: 0, away: 1 }, { home_score: 2, away_score: 0 });
  assert.deepEqual(facts, { exact: false, correct_outcome: false, correct_diff: false });
});

test("getScorer(): scorer_key inconnu lève une exception fail-closed", () => {
  assert.throws(() => getScorer("pole_position.v1"), UnknownScorerError);
});

test("getScorer(): match_winner_1x2.v1 retiré (Lot 3D, Architecture B) lève désormais fail-closed", () => {
  assert.throws(() => getScorer("match_winner_1x2.v1"), UnknownScorerError);
});

test("getScorer(): résout exact_score.v1 et produit des faits sans aucun scoring_rules", () => {
  const exactScorer = getScorer("exact_score.v1");
  // Aucun accès DB dans cette fonction : le fait qu'elle s'exécute ici, en
  // dehors de toute connexion Supabase, avec scoring_rules à 0 ligne en
  // base (vérifié en direct sur yfhuqsuboqfznnpceosl), démontre qu'elle ne
  // dépend d'aucun barème pour produire des faits.
  assert.deepEqual(exactScorer({ home: 0, away: 0 }, { home_score: 0, away_score: 0 }), {
    exact: true,
    correct_outcome: true,
    correct_diff: true,
  });
});
