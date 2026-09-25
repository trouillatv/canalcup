// Exécuter : npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_REGISTRY,
  isFeatureEnabled,
  requireFeature,
  featureGuardResponse,
  FeatureDisabledError,
} from "./flags.ts";

test("les modules cœur du nouveau produit sont ON", () => {
  for (const key of ["predictions", "briefs", "program", "rankings", "notifications"] as const) {
    assert.equal(FEATURE_REGISTRY[key], "on", `${key} devrait être ON`);
    assert.equal(isFeatureEnabled(key), true);
  }
});

test("les modules hérités de Canal Cup sont OFF par défaut", () => {
  for (const key of ["quiz", "babyfoot", "jokers", "social", "ceremony"] as const) {
    assert.equal(FEATURE_REGISTRY[key], "off", `${key} devrait être OFF`);
    assert.equal(isFeatureEnabled(key), false);
  }
});

test("requireFeature lève pour un module OFF", () => {
  assert.throws(() => requireFeature("quiz"), FeatureDisabledError);
});

test("requireFeature ne lève pas pour un module ON", () => {
  assert.doesNotThrow(() => requireFeature("predictions"));
});

test("featureGuardResponse renvoie un 403 pour un module OFF", async () => {
  const res = featureGuardResponse("babyfoot");
  assert.ok(res, "devrait renvoyer une Response");
  assert.equal(res?.status, 403);
  const body = await res?.json();
  assert.match(body.error, /babyfoot/);
});

test("featureGuardResponse renvoie null pour un module ON", () => {
  assert.equal(featureGuardResponse("rankings"), null);
});
