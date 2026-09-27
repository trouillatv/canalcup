// Tests unitaires — barèmes candidats et application des points (Lot 3C).
// Réutilise le vrai scorer Lot 3B (`computeExactScoreFacts`), pas une
// réimplémentation, pour rester fidèle au moteur réel.

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeExactScoreFacts } from "../predictions/scorers.ts";
import {
  ALL_SCHEMES,
  BASELINE_0_3_2,
  SCHEME_2_3,
  SCHEME_3_1,
  SCHEME_1_3,
  SCHEME_4_1,
  DIFF_BONUS_HYPOTHESIS,
  applyScheme,
} from "./scoring-schemes.ts";

test("6 barèmes déclarés, incluant la référence Vincent (= variante 3+2)", () => {
  assert.equal(ALL_SCHEMES.length, 6);
  assert.ok(ALL_SCHEMES.includes(BASELINE_0_3_2));
});

test("clés de barème toutes uniques", () => {
  const keys = new Set(ALL_SCHEMES.map((s) => s.key));
  assert.equal(keys.size, ALL_SCHEMES.length);
});

test("score exact : plafond à 5 points sur le barème de référence (3 + 2)", () => {
  const facts = computeExactScoreFacts({ home: 2, away: 1 }, { home_score: 2, away_score: 1 });
  const breakdown = applyScheme(BASELINE_0_3_2, facts);
  assert.equal(breakdown.total, 5);
  assert.equal(breakdown.outcomePoints, 3);
  assert.equal(breakdown.exactPoints, 2);
});

test("bon résultat sans score exact : seuls les points de résultat sont attribués", () => {
  const facts = computeExactScoreFacts({ home: 3, away: 1 }, { home_score: 2, away_score: 1 });
  const breakdown = applyScheme(BASELINE_0_3_2, facts);
  assert.equal(breakdown.total, 3);
  assert.equal(breakdown.exactPoints, 0);
});

test("résultat faux : zéro point quel que soit le barème", () => {
  const facts = computeExactScoreFacts({ home: 0, away: 2 }, { home_score: 2, away_score: 0 });
  for (const scheme of ALL_SCHEMES) {
    const breakdown = applyScheme(scheme, facts);
    assert.equal(breakdown.total, 0, `${scheme.key} devrait donner 0 point sur un résultat faux`);
  }
});

test("le bonus exact n'est jamais attribué sans le bonus de résultat correct (implication garantie par le scorer réel)", () => {
  const facts = computeExactScoreFacts({ home: 1, away: 1 }, { home_score: 1, away_score: 1 });
  assert.ok(facts.exact && facts.correct_outcome);
  for (const scheme of ALL_SCHEMES) {
    const breakdown = applyScheme(scheme, facts);
    if (breakdown.exactPoints > 0) assert.ok(breakdown.outcomePoints > 0);
  }
});

test("variantes 2+3, 3+1, 1+3, 4+1 : poids conformes à leur nom", () => {
  const facts = computeExactScoreFacts({ home: 1, away: 0 }, { home_score: 1, away_score: 0 });
  assert.deepEqual(
    [SCHEME_2_3, SCHEME_3_1, SCHEME_1_3, SCHEME_4_1].map((s) => applyScheme(s, facts).total),
    [5, 4, 4, 5]
  );
});

test("hypothèse bonus diff : n'ajoute le bonus que si le score n'est pas déjà exact (pas de double-comptage)", () => {
  const exactFacts = computeExactScoreFacts({ home: 2, away: 0 }, { home_score: 2, away_score: 0 });
  const exactBreakdown = applyScheme(DIFF_BONUS_HYPOTHESIS, exactFacts);
  assert.equal(exactBreakdown.diffPoints, 0);
  assert.equal(exactBreakdown.total, 5); // 3 + 2, pas +1 supplémentaire

  const diffOnlyFacts = computeExactScoreFacts({ home: 3, away: 1 }, { home_score: 2, away_score: 0 });
  assert.ok(diffOnlyFacts.correct_diff && !diffOnlyFacts.exact);
  const diffBreakdown = applyScheme(DIFF_BONUS_HYPOTHESIS, diffOnlyFacts);
  assert.equal(diffBreakdown.diffPoints, 1);
  assert.equal(diffBreakdown.total, 4); // 3 (résultat) + 1 (diff), pas de bonus exact
});
