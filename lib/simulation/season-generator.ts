// Génère une saison complète simulée pour une réplication Monte-Carlo — Lot 3C.
//
// FAIT : la journée 1 (18 matchs) garde ses résultats réels, identiques dans
// toutes les réplications (ce sont des faits, pas un tirage aléatoire).
// HYPOTHÈSE : les journées 2 à 8 (126 matchs, non joués au 2026-09-25) sont
// tirées à chaque réplication via le modèle de force synthétique
// (team-strength.ts) — un tirage Poisson indépendant par équipe et par
// match, jamais réutilisé d'une réplication à l'autre (c'est précisément ce
// qui crée la variance saison-à-saison nécessaire à l'analyse Monte-Carlo).

import { type Rng, samplePoisson } from "./rng.ts";
import type { CalendarFixture } from "./calendar.ts";
import { type TeamStrengths, expectedGoals } from "./team-strength.ts";

export type MatchResult = { home_score: number; away_score: number };

export type GeneratedFixture = CalendarFixture & {
  // Résultat retenu pour cette réplication : le résultat réel pour la
  // journée 1, un résultat simulé pour les journées 2 à 8.
  result: MatchResult;
  wasSimulated: boolean;
};

export function generateSeason(
  calendar: CalendarFixture[],
  strengths: TeamStrengths,
  rng: Rng
): GeneratedFixture[] {
  return calendar.map((fixture) => {
    if (fixture.realResult) {
      return { ...fixture, result: fixture.realResult, wasSimulated: false };
    }
    const { home: lambdaHome, away: lambdaAway } = expectedGoals(strengths, fixture.home, fixture.away);
    const result: MatchResult = {
      home_score: samplePoisson(rng, lambdaHome),
      away_score: samplePoisson(rng, lambdaAway),
    };
    return { ...fixture, result, wasSimulated: true };
  });
}
