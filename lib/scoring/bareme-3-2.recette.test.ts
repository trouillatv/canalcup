// Recette Lot 3D, Volet A — correction du calcul 3+2 sur des résultats
// RÉELS de Champions League 2026/27 déjà `finished` (lus en direct via
// Supabase MCP le 2026-09-25, `yfhuqsuboqfznnpceosl`, non modifiés ici —
// fixture en dur, aucun accès DB dans ce fichier). Couvre les trois
// paliers du barème (5/3/0) avec des scores pronostiqués synthétiques,
// via le pipeline réel getScorer()/computeExactScoreFacts() ->
// resolvePoints() (lib/scoring/rules.ts), sans passer par settle.ts
// (qui, lui, dépend de la DB — voir settle.test.ts, self-skip local tant
// que la tâche #16 n'est pas résolue).

import { test } from "node:test";
import assert from "node:assert/strict";
import { getScorer } from "../predictions/scorers.ts";
import { resolvePoints, type ScoringClause } from "./rules.ts";

// Règle 3+2 réellement active en base (scoring_rules, market exact_score),
// voir ADR 0005 "Décisions validées (2026-09-25, Lot 3D)" point 2.
const BAREME_3_2: ScoringClause[] = [
  { when: { exact: true }, points: 5 },
  { when: { correct_outcome: true }, points: 3 },
  { when: {}, points: 0 },
];

const scorer = getScorer("exact_score.v1");

function pointsFor(payload: { home: number; away: number }, result: { home_score: number; away_score: number }) {
  const facts = scorer(payload, result);
  return { facts, points: resolvePoints(BAREME_3_2, facts) };
}

test("Real Madrid CF 2-1 FC Internazionale Milano (2026-09-08, finished réel) — score exact -> 5 pts", () => {
  const result = { home_score: 2, away_score: 1 };
  const { facts, points } = pointsFor({ home: 2, away: 1 }, result);
  assert.deepEqual(facts, { exact: true, correct_outcome: true, correct_diff: true });
  assert.equal(points, 5);
});

test("Real Madrid CF 2-1 FC Internazionale Milano — bon résultat, score inexact -> 3 pts", () => {
  const result = { home_score: 2, away_score: 1 };
  const { facts, points } = pointsFor({ home: 3, away: 1 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, true);
  assert.equal(points, 3);
});

test("Real Madrid CF 2-1 FC Internazionale Milano — mauvais résultat -> 0 pt", () => {
  const result = { home_score: 2, away_score: 1 };
  const { facts, points } = pointsFor({ home: 1, away: 2 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, false);
  assert.equal(points, 0);
});

test("Club Brugge KV 2-3 Aston Villa FC (2026-09-08, finished réel) — score exact -> 5 pts", () => {
  const result = { home_score: 2, away_score: 3 };
  const { facts, points } = pointsFor({ home: 2, away: 3 }, result);
  assert.deepEqual(facts, { exact: true, correct_outcome: true, correct_diff: true });
  assert.equal(points, 5);
});

test("Club Brugge KV 2-3 Aston Villa FC — bon résultat (victoire extérieure), score inexact -> 3 pts", () => {
  const result = { home_score: 2, away_score: 3 };
  const { facts, points } = pointsFor({ home: 0, away: 1 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, true);
  assert.equal(points, 3);
});

test("Club Brugge KV 2-3 Aston Villa FC — nul pronostiqué, mauvais résultat -> 0 pt", () => {
  const result = { home_score: 2, away_score: 3 };
  const { facts, points } = pointsFor({ home: 1, away: 1 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, false);
  assert.equal(points, 0);
});

test("PAE AEK 1-0 LASK Linz (2026-09-08, finished réel) — score exact -> 5 pts", () => {
  const result = { home_score: 1, away_score: 0 };
  const { facts, points } = pointsFor({ home: 1, away: 0 }, result);
  assert.deepEqual(facts, { exact: true, correct_outcome: true, correct_diff: true });
  assert.equal(points, 5);
});

test("PAE AEK 1-0 LASK Linz — bon résultat (victoire domicile), score inexact -> 3 pts", () => {
  const result = { home_score: 1, away_score: 0 };
  const { facts, points } = pointsFor({ home: 2, away: 0 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, true);
  assert.equal(points, 3);
});

test("PAE AEK 1-0 LASK Linz — victoire extérieure pronostiquée, mauvais résultat -> 0 pt", () => {
  const result = { home_score: 1, away_score: 0 };
  const { facts, points } = pointsFor({ home: 0, away: 1 }, result);
  assert.equal(facts.exact, false);
  assert.equal(facts.correct_outcome, false);
  assert.equal(points, 0);
});
