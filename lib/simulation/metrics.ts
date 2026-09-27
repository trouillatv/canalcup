// Fonctions statistiques pures pour l'analyse des résultats de simulation —
// Lot 3C, checklist point 4. Aucune dépendance au moteur : opèrent
// uniquement sur des tableaux de nombres/faits déjà produits par engine.ts.

import type { MatchFacts, PointBreakdown } from "./scoring-schemes.ts";

export type SummaryStats = {
  n: number;
  mean: number;
  median: number;
  variance: number; // variance d'échantillon (n-1), non biaisée
  stdDev: number;
  min: number;
  max: number;
};

export function mean(values: number[]): number {
  if (values.length === 0) return NaN;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// Variance d'échantillon (division par n-1) — cohérent avec le fait que
// chaque réplication Monte-Carlo est un échantillon d'une population plus
// large de saisons/joueurs possibles, pas la population elle-même.
export function variance(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const sumSq = values.reduce((acc, v) => acc + (v - m) ** 2, 0);
  return sumSq / (values.length - 1);
}

export function stdDev(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function summarize(values: number[]): SummaryStats {
  return {
    n: values.length,
    mean: mean(values),
    median: median(values),
    variance: variance(values),
    stdDev: stdDev(values),
    min: values.length ? Math.min(...values) : NaN,
    max: values.length ? Math.max(...values) : NaN,
  };
}

// Histogramme brut valeur -> fréquence, pour visualiser la distribution des
// scores finaux (totaux entiers bornés, pas de bucketing nécessaire).
export function distribution(values: number[]): Map<number, number> {
  const hist = new Map<number, number>();
  for (const v of values) hist.set(v, (hist.get(v) ?? 0) + 1);
  return hist;
}

export type PointShare = { outcomeShare: number; exactShare: number; diffShare: number };

// Part des points totaux issue de chaque composante du barème, agrégée sur
// un ensemble de breakdowns (typiquement : tous les matchs de tous les
// joueurs d'un profil, à 0% d'absence).
export function pointSourceShare(breakdowns: PointBreakdown[]): PointShare {
  let outcome = 0;
  let exact = 0;
  let diff = 0;
  let total = 0;
  for (const b of breakdowns) {
    outcome += b.outcomePoints;
    exact += b.exactPoints;
    diff += b.diffPoints;
    total += b.total;
  }
  if (total === 0) return { outcomeShare: 0, exactShare: 0, diffShare: 0 };
  return { outcomeShare: outcome / total, exactShare: exact / total, diffShare: diff / total };
}

export function exactFrequency(facts: MatchFacts[]): number {
  if (facts.length === 0) return 0;
  return facts.filter((f) => f.exact).length / facts.length;
}

export type Discrimination = { meanA: number; meanB: number; gap: number; cohensD: number };

// Cohen's d avec écart-type combiné (pooled). Mesure la "capacité à
// distinguer un profil performant d'un profil aléatoire" indépendamment de
// l'échelle du barème (d ~0.2 faible, ~0.5 moyen, ~0.8 fort, convention
// usuelle).
export function discrimination(poolA: number[], poolB: number[]): Discrimination {
  const meanA = mean(poolA);
  const meanB = mean(poolB);
  const varA = variance(poolA);
  const varB = variance(poolB);
  const nA = poolA.length;
  const nB = poolB.length;
  const pooledVar = ((nA - 1) * varA + (nB - 1) * varB) / (nA + nB - 2);
  const pooledStdDev = Math.sqrt(pooledVar);
  return {
    meanA,
    meanB,
    gap: meanA - meanB,
    cohensD: pooledStdDev === 0 ? 0 : (meanA - meanB) / pooledStdDev,
  };
}

// Fraction de joueurs dont le total est partagé par au moins un autre
// joueur du même pool (égalité stricte au classement).
export function tieRate(totals: number[]): number {
  if (totals.length === 0) return 0;
  const counts = distribution(totals);
  let tied = 0;
  for (const count of counts.values()) {
    if (count > 1) tied += count;
  }
  return tied / totals.length;
}

// Fraction de joueurs dont le total atteint ou dépasse un seuil donné
// (typiquement la médiane d'un pool de référence à 0% d'absence) — sert à
// mesurer si des absences rendent statistiquement "impossible" de rester
// dans la moyenne du classement.
export function survivalAboveThreshold(totals: number[], threshold: number): number {
  if (totals.length === 0) return 0;
  return totals.filter((t) => t >= threshold).length / totals.length;
}
