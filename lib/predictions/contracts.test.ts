// Tests unitaires — validateurs de payload V1 (voir
// docs/adr/0005-prediction-engine-market-types.md, section 3 et 7,
// checklist Round 2 point 6). Purement structurels, aucun accès réseau/DB.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getValidator,
  InvalidPredictionPayloadError,
  UnknownMarketValidatorError,
} from "./contracts.ts";

test("exact_score: accepte un score borné 0..20", () => {
  const validate = getValidator("exact_score");
  assert.deepEqual(validate({ home: 2, away: 1 }), { home: 2, away: 1 });
  assert.deepEqual(validate({ home: 0, away: 0 }), { home: 0, away: 0 });
  assert.deepEqual(validate({ home: 20, away: 20 }), { home: 20, away: 20 });
});

test("exact_score: rejette une clé manquante ou en trop", () => {
  const validate = getValidator("exact_score");
  assert.throws(() => validate({ home: 2 }), InvalidPredictionPayloadError);
  assert.throws(() => validate({ home: 2, away: 1, extra: true }), InvalidPredictionPayloadError);
});

test("exact_score: rejette un score négatif, non entier, ou > 20", () => {
  const validate = getValidator("exact_score");
  assert.throws(() => validate({ home: -1, away: 0 }), InvalidPredictionPayloadError);
  assert.throws(() => validate({ home: 1.5, away: 0 }), InvalidPredictionPayloadError);
  assert.throws(() => validate({ home: 21, away: 0 }), InvalidPredictionPayloadError);
});

test("exact_score: rejette un type non numérique", () => {
  const validate = getValidator("exact_score");
  assert.throws(() => validate({ home: "2", away: 1 }), InvalidPredictionPayloadError);
});

test("getValidator(): marché inconnu lève une exception fail-closed, jamais un passage silencieux", () => {
  assert.throws(() => getValidator("pole_position"), UnknownMarketValidatorError);
});

test("getValidator(): match_winner_1x2 retiré (Lot 3D, Architecture B) lève désormais fail-closed", () => {
  assert.throws(() => getValidator("match_winner_1x2"), UnknownMarketValidatorError);
});
