// Tests unitaires — PRNG seedé (Lot 3C). Garantit la reproductibilité
// stricte exigée pour comparer plusieurs barèmes sur les mêmes saisons.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createRng,
  deriveSeed,
  sampleNormal,
  samplePoisson,
  sampleBernoulli,
  sampleUniformInt,
} from "./rng.ts";

test("createRng: même seed => même séquence exacte", () => {
  const a = createRng(42);
  const b = createRng(42);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  assert.deepEqual(seqA, seqB);
});

test("createRng: seeds différents => séquences différentes", () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: 10 }, () => a());
  const seqB = Array.from({ length: 10 }, () => b());
  assert.notDeepEqual(seqA, seqB);
});

test("createRng: valeurs dans [0, 1)", () => {
  const rng = createRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `valeur hors bornes: ${v}`);
  }
});

test("deriveSeed: déterministe pour les mêmes composants", () => {
  assert.equal(deriveSeed(42, "user", "aleatoire", 3, "rep", 5), deriveSeed(42, "user", "aleatoire", 3, "rep", 5));
});

test("deriveSeed: composants différents => seed différent (pas de collision triviale)", () => {
  const s1 = deriveSeed(42, "user", "aleatoire", 3, "rep", 5);
  const s2 = deriveSeed(42, "user", "aleatoire", 4, "rep", 5);
  const s3 = deriveSeed(42, "user", "favori", 3, "rep", 5);
  assert.notEqual(s1, s2);
  assert.notEqual(s1, s3);
});

test("sampleNormal: moyenne et écart-type approximativement corrects sur un grand échantillon", () => {
  const rng = createRng(123);
  const n = 20000;
  const samples = Array.from({ length: n }, () => sampleNormal(rng, 10, 2));
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance = samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n;
  assert.ok(Math.abs(mean - 10) < 0.1, `moyenne hors tolérance: ${mean}`);
  assert.ok(Math.abs(Math.sqrt(variance) - 2) < 0.1, `écart-type hors tolérance: ${Math.sqrt(variance)}`);
});

test("samplePoisson: moyenne approximativement égale à lambda", () => {
  const rng = createRng(456);
  const lambda = 1.8;
  const n = 20000;
  const samples = Array.from({ length: n }, () => samplePoisson(rng, lambda));
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  assert.ok(Math.abs(mean - lambda) < 0.05, `moyenne hors tolérance: ${mean}`);
  assert.ok(samples.every((v) => Number.isInteger(v) && v >= 0));
});

test("sampleBernoulli: fréquence approximativement égale à la probabilité", () => {
  const rng = createRng(789);
  const p = 0.2;
  const n = 20000;
  const trues = Array.from({ length: n }, () => sampleBernoulli(rng, p)).filter(Boolean).length;
  assert.ok(Math.abs(trues / n - p) < 0.02, `fréquence hors tolérance: ${trues / n}`);
});

test("sampleUniformInt: bornes respectées et distribution couvre l'intervalle", () => {
  const rng = createRng(321);
  const values = new Set<number>();
  for (let i = 0; i < 2000; i++) {
    const v = sampleUniformInt(rng, 3, 7);
    assert.ok(v >= 3 && v <= 7);
    values.add(v);
  }
  assert.deepEqual([...values].sort(), [3, 4, 5, 6, 7]);
});
