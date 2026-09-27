// Modèle de force synthétique par équipe — Lot 3C.
//
// FAIT (calibrage, pas vérité terrain) : sur les 18 résultats réels de la
// journée 1 (seule journée jouée au 2026-09-25), on observe 11 victoires
// domicile, 5 victoires extérieur, 2 nuls (~61.1% / ~27.8% / ~11.1%) et
// 69 buts marqués sur 18 matchs (~3.83 buts/match). Échantillon = 18, donc
// ce n'est qu'une cible de calibrage grossière pour les paramètres
// ci-dessous, pas une distribution réelle établie.
//
// HYPOTHÈSE (non vérifiable avec les données ingérées) : aucune donnée de
// classement/cote/force d'équipe n'existe dans le schéma CANAL Sports
// (`participants` n'a pas de colonne ranking/coefficient — vérifié par
// `list_tables` en lecture seule). On modélise donc une force latente
// synthétique par équipe (attack/defense), tirée une seule fois par seed,
// puis fixée pour toutes les réplications Monte-Carlo. Ce n'est PAS une
// estimation de la vraie force des équipes réelles — seulement un dispositif
// de simulation documenté, nécessaire pour donner un signal exploitable aux
// profils "favori"/"expert_simule" sans jamais toucher un résultat de match.
//
// Buts par match modélisés par un Poisson log-additif :
//   lambda_home = exp(BASE_LOG_RATE + attack[home] - defense[away] + HOME_ADVANTAGE)
//   lambda_away = exp(BASE_LOG_RATE + attack[away] - defense[home])
// attack/defense ~ Normal(0, STRENGTH_STD_DEV), indépendants entre équipes.

import { createRng, deriveSeed, sampleNormal } from "./rng.ts";

export const STRENGTH_STD_DEV = 0.35;
// Calibré par recherche en grille (Monte-Carlo, 40k tirages, seed=42/12345)
// sur des paires d'équipes aléatoires parmi les 36 : HOME_ADVANTAGE=0.6 et
// BASE_LOG_RATE=0.42 donnent ~59.8% victoires domicile / ~17.4% nuls /
// ~22.8% victoires extérieur / ~4.04 buts/match en moyenne, à comparer à la
// cible MD1 (61.1% / 11.1% / 27.8% / 3.83 buts, n=18). L'écart sur le taux
// de nuls n'a pas pu être résorbé : un modèle Poisson indépendant home/away
// produit structurellement ~15-20% de nuls quel que soit le réglage testé
// (STD 0.35 à 0.8, HOME_ADVANTAGE 0.25 à 0.9) — un nul aussi rare que 11.1%
// sur seulement 18 matchs est plausiblement du bruit d'échantillonnage
// (avec n=18, l'intervalle de confiance autour de 2 nuls observés est très
// large) plutôt qu'un taux structurel à reproduire exactement. Voir
// docs/lot3c-scoring-simulation.md section méthodologie.
export const HOME_ADVANTAGE = 0.6;
export const BASE_LOG_RATE = 0.42;

// Bruit ajouté à la force réelle pour obtenir la "perception publique" que
// consomment les profils favori/expert_simule — jamais dérivé d'un résultat
// de match, réel ou simulé.
export const PUBLIC_PERCEPTION_NOISE_STD_DEV_FAVORI = 0.30;
export const PUBLIC_PERCEPTION_NOISE_STD_DEV_EXPERT = 0.12;

export type TeamStrength = {
  attack: number;
  defense: number;
};

export type TeamStrengths = Map<string, TeamStrength>;

// Perception publique = force réelle + bruit indépendant. Un bruit distinct
// par "niveau de perception" (favori vs expert_simule) permet à l'expert
// d'être mieux informé sans jamais voir la force réelle ni un résultat.
export type PublicPerception = Map<string, TeamStrength>;

export function buildTeamStrengths(teams: string[], baseSeed: number): TeamStrengths {
  const rng = createRng(deriveSeed(baseSeed, "team-strength"));
  const strengths: TeamStrengths = new Map();
  for (const team of teams) {
    strengths.set(team, {
      attack: sampleNormal(rng, 0, STRENGTH_STD_DEV),
      defense: sampleNormal(rng, 0, STRENGTH_STD_DEV),
    });
  }
  return strengths;
}

function buildPerception(
  trueStrengths: TeamStrengths,
  baseSeed: number,
  streamName: string,
  noiseStdDev: number
): PublicPerception {
  const rng = createRng(deriveSeed(baseSeed, streamName));
  const perception: PublicPerception = new Map();
  for (const [team, strength] of trueStrengths) {
    perception.set(team, {
      attack: strength.attack + sampleNormal(rng, 0, noiseStdDev),
      defense: strength.defense + sampleNormal(rng, 0, noiseStdDev),
    });
  }
  return perception;
}

export function buildFavoriPerception(trueStrengths: TeamStrengths, baseSeed: number): PublicPerception {
  return buildPerception(trueStrengths, baseSeed, "perception-favori", PUBLIC_PERCEPTION_NOISE_STD_DEV_FAVORI);
}

export function buildExpertPerception(trueStrengths: TeamStrengths, baseSeed: number): PublicPerception {
  return buildPerception(trueStrengths, baseSeed, "perception-expert", PUBLIC_PERCEPTION_NOISE_STD_DEV_EXPERT);
}

export function expectedGoals(
  strengths: TeamStrengths | PublicPerception,
  home: string,
  away: string
): { home: number; away: number } {
  const homeStrength = strengths.get(home);
  const awayStrength = strengths.get(away);
  if (!homeStrength || !awayStrength) {
    throw new Error(`Force inconnue pour ${!homeStrength ? home : away}`);
  }
  return {
    home: Math.exp(BASE_LOG_RATE + homeStrength.attack - awayStrength.defense + HOME_ADVANTAGE),
    away: Math.exp(BASE_LOG_RATE + awayStrength.attack - homeStrength.defense),
  };
}

// Vainqueur implicite selon la perception publique donnée — jamais la force
// réelle, jamais un résultat. `null` si les deux équipes sont perçues à
// égalité stricte (rare avec des floats, géré pour rester déterministe).
export function perceivedFavorite(
  perception: PublicPerception,
  home: string,
  away: string
): "home" | "away" | null {
  const { home: lambdaHome, away: lambdaAway } = expectedGoals(perception, home, away);
  if (lambdaHome === lambdaAway) return null;
  return lambdaHome > lambdaAway ? "home" : "away";
}
