// Tests unitaires — resolvePoints() (voir lib/scoring/rules.ts, ADR 0005
// section 4). Purement structurels, aucun accès DB : la règle barème 3+2
// est reproduite ici en dur, indépendamment de ce qui est réellement inséré
// dans scoring_rules (vérifié séparément en base sur yfhuqsuboqfznnpceosl).

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePoints, NoMatchingScoringClauseError, type ScoringClause } from "./rules.ts";

const BAREME_3_2: ScoringClause[] = [
  { when: { exact: true }, points: 5 },
  { when: { correct_outcome: true }, points: 3 },
  { when: {}, points: 0 },
];

test("resolvePoints(): score exact -> 5 points", () => {
  const facts = { exact: true, correct_outcome: true, correct_diff: true };
  assert.equal(resolvePoints(BAREME_3_2, facts), 5);
});

test("resolvePoints(): bon résultat 1N2 mais score inexact -> 3 points", () => {
  const facts = { exact: false, correct_outcome: true, correct_diff: false };
  assert.equal(resolvePoints(BAREME_3_2, facts), 3);
});

test("resolvePoints(): tout faux -> 0 point (clause catch-all)", () => {
  const facts = { exact: false, correct_outcome: false, correct_diff: false };
  assert.equal(resolvePoints(BAREME_3_2, facts), 0);
});

test("resolvePoints(): l'ordre des clauses fait foi (première correspondance gagne)", () => {
  // Si la clause exact=5 était placée après correct_outcome=3, un score
  // exact (qui implique correct_outcome=true) tomberait à tort sur 3.
  const reordered: ScoringClause[] = [
    { when: { correct_outcome: true }, points: 3 },
    { when: { exact: true }, points: 5 },
    { when: {}, points: 0 },
  ];
  const facts = { exact: true, correct_outcome: true, correct_diff: true };
  assert.equal(resolvePoints(reordered, facts), 3);
});

test("resolvePoints(): aucune clause catch-all et aucun match -> lève une exception fail-closed", () => {
  const noCatchAll: ScoringClause[] = [{ when: { exact: true }, points: 5 }];
  const facts = { exact: false, correct_outcome: false, correct_diff: false };
  assert.throws(() => resolvePoints(noCatchAll, facts), NoMatchingScoringClauseError);
});
