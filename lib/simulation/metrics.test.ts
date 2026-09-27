// Tests unitaires — fonctions statistiques (Lot 3C). Données synthétiques
// choisies à la main (pas de dépendance au moteur), pour vérifier chaque
// formule indépendamment.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  median,
  variance,
  stdDev,
  summarize,
  distribution,
  pointSourceShare,
  exactFrequency,
  discrimination,
  tieRate,
  survivalAboveThreshold,
} from "./metrics.ts";

test("mean: moyenne simple", () => {
  assert.equal(mean([1, 2, 3, 4]), 2.5);
});

test("median: nombre pair et impair d'éléments", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([1, 2, 3]), 2);
});

test("variance et stdDev: cas connu (échantillon)", () => {
  const values = [2, 4, 4, 4, 5, 5, 7, 9];
  // variance d'échantillon connue pour ce jeu de données = 4.571428...
  assert.ok(Math.abs(variance(values) - 4.571428571428571) < 1e-9);
  assert.ok(Math.abs(stdDev(values) - Math.sqrt(4.571428571428571)) < 1e-9);
});

test("variance: 0 pour un seul point (pas de division par zéro)", () => {
  assert.equal(variance([5]), 0);
  assert.equal(variance([]), 0);
});

test("summarize: regroupe toutes les stats", () => {
  const s = summarize([1, 2, 3, 4, 5]);
  assert.equal(s.n, 5);
  assert.equal(s.mean, 3);
  assert.equal(s.median, 3);
  assert.equal(s.min, 1);
  assert.equal(s.max, 5);
});

test("distribution: histogramme exact valeur -> fréquence", () => {
  const hist = distribution([1, 1, 2, 3, 3, 3]);
  assert.equal(hist.get(1), 2);
  assert.equal(hist.get(2), 1);
  assert.equal(hist.get(3), 3);
});

test("pointSourceShare: parts correctes sur un jeu de breakdowns connu", () => {
  const breakdowns = [
    { outcomePoints: 3, exactPoints: 2, diffPoints: 0, total: 5 },
    { outcomePoints: 3, exactPoints: 0, diffPoints: 0, total: 3 },
    { outcomePoints: 0, exactPoints: 0, diffPoints: 0, total: 0 },
  ];
  const share = pointSourceShare(breakdowns);
  // total global = 8, outcome = 6, exact = 2
  assert.ok(Math.abs(share.outcomeShare - 6 / 8) < 1e-9);
  assert.ok(Math.abs(share.exactShare - 2 / 8) < 1e-9);
  assert.equal(share.diffShare, 0);
});

test("pointSourceShare: tout à zéro si aucun point marqué", () => {
  const share = pointSourceShare([{ outcomePoints: 0, exactPoints: 0, diffPoints: 0, total: 0 }]);
  assert.deepEqual(share, { outcomeShare: 0, exactShare: 0, diffShare: 0 });
});

test("exactFrequency: fraction correcte de faits 'exact'", () => {
  const facts = [
    { correct_outcome: true, exact: true, correct_diff: true },
    { correct_outcome: true, exact: false, correct_diff: true },
    { correct_outcome: false, exact: false, correct_diff: false },
    { correct_outcome: false, exact: false, correct_diff: false },
  ];
  assert.equal(exactFrequency(facts), 0.25);
});

test("discrimination: pool A nettement supérieur à pool B => gap et Cohen's d positifs", () => {
  const poolA = [10, 12, 11, 13, 9];
  const poolB = [1, 3, 2, 4, 0];
  const d = discrimination(poolA, poolB);
  assert.ok(d.gap > 0);
  assert.ok(d.cohensD > 0);
  assert.ok(Math.abs(d.meanA - 11) < 1e-9);
  assert.ok(Math.abs(d.meanB - 2) < 1e-9);
});

test("discrimination: pools identiques => gap nul, Cohen's d nul", () => {
  const pool = [5, 5, 5, 5];
  const d = discrimination(pool, pool);
  assert.equal(d.gap, 0);
  assert.equal(d.cohensD, 0);
});

test("tieRate: fraction de joueurs partageant leur total avec au moins un autre", () => {
  // totals: 10 (x2 joueurs), 20 (x1), 30 (x2) => 4/5 des joueurs sont en égalité
  const totals = [10, 10, 20, 30, 30];
  assert.ok(Math.abs(tieRate(totals) - 4 / 5) < 1e-9);
});

test("tieRate: 0 si tous les totaux sont distincts", () => {
  assert.equal(tieRate([1, 2, 3, 4]), 0);
});

test("survivalAboveThreshold: fraction correcte au-dessus du seuil (inclusif)", () => {
  const totals = [10, 20, 30, 40, 50];
  assert.ok(Math.abs(survivalAboveThreshold(totals, 30) - 3 / 5) < 1e-9);
});
