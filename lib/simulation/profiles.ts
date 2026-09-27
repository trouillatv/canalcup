// Profils synthétiques de pronostiqueurs — Lot 3C, checklist point 3.
//
// GARDE-FOU STRUCTUREL (aucune fuite de résultat) : chaque profil est une
// fonction pure de (identité du match, perception publique, flux rng dédié)
// — sa signature ne reçoit JAMAIS le résultat réel ou simulé du match.
// Ceci est vérifié explicitement par un test (voir profiles.test.ts) qui
// inspecte les paramètres de la fonction, pas seulement son comportement.
//
// HYPOTHÈSE (aucune donnée réelle de force/classement disponible, voir
// team-strength.ts) : "favori" et "expert_simule" s'appuient sur une
// perception publique synthétique (force réelle + bruit), jamais sur la
// force réelle elle-même ni sur un résultat. "expert_simule" utilise une
// perception moins bruitée que "favori" (voir
// PUBLIC_PERCEPTION_NOISE_STD_DEV_EXPERT < ..._FAVORI dans team-strength.ts)
// — c'est la seule raison pour laquelle il performe mieux en moyenne : il
// est mieux informé, pas voyant.

import { type Rng, samplePoisson } from "./rng.ts";
import { type PublicPerception, expectedGoals } from "./team-strength.ts";
import type { ExactScorePayload } from "../predictions/contracts.ts";

export type FixtureIdentity = { home: string; away: string };

export type ProfileContext = {
  rng: Rng;
  favoriPerception: PublicPerception;
  expertPerception: PublicPerception;
};

export type ProfileKey = "aleatoire" | "favori" | "prudent" | "contrarian" | "expert_simule";

export type Profile = (fixture: FixtureIdentity, ctx: ProfileContext) => ExactScorePayload;

// Aucune information d'équipe : Poisson symétrique à lambda fixe, calibré
// sur une moyenne de but "raisonnable" par équipe (~1.35, cohérent avec la
// cible ~3.83 buts/match au total tirée de MD1 — voir team-strength.ts).
const ALEATOIRE_LAMBDA = 1.35;

function aleatoire(_fixture: FixtureIdentity, ctx: ProfileContext): ExactScorePayload {
  return {
    home: samplePoisson(ctx.rng, ALEATOIRE_LAMBDA),
    away: samplePoisson(ctx.rng, ALEATOIRE_LAMBDA),
  };
}

// Score "usuel" à faible amplitude, indépendant de l'identité des équipes —
// un pronostiqueur prudent qui ne mise jamais sur un scénario extrême.
const PRUDENT_SCORELINES: ExactScorePayload[] = [
  { home: 1, away: 0 },
  { home: 0, away: 0 },
  { home: 1, away: 1 },
  { home: 2, away: 1 },
  { home: 1, away: 2 },
  { home: 2, away: 0 },
];

function prudent(_fixture: FixtureIdentity, ctx: ProfileContext): ExactScorePayload {
  const idx = Math.floor(ctx.rng() * PRUDENT_SCORELINES.length);
  return PRUDENT_SCORELINES[idx];
}

// Tire un score via Poisson sur les buts attendus (perception donnée), en
// forçant un score non-nul d'écart si les deux tirages sont égaux — un
// pronostiqueur "favori"/"expert" ne rend jamais un match nul dans ses
// pronostics (hypothèse produit, cohérente avec la consigne : il "privilégie
// systématiquement" un vainqueur).
function scorelineFavoringWinner(
  perception: PublicPerception,
  fixture: FixtureIdentity,
  rng: Rng,
  favorWinner: "perceived" | "underdog"
): ExactScorePayload {
  const { home: lambdaHome, away: lambdaAway } = expectedGoals(perception, fixture.home, fixture.away);
  const perceivedWinnerIsHome = lambdaHome >= lambdaAway;
  const winnerIsHome = favorWinner === "perceived" ? perceivedWinnerIsHome : !perceivedWinnerIsHome;

  let home = samplePoisson(rng, lambdaHome);
  let away = samplePoisson(rng, lambdaAway);
  if (home === away) {
    if (winnerIsHome) home += 1;
    else away += 1;
  } else {
    // Le tirage Poisson peut désigner l'autre équipe que celle qu'on veut
    // favoriser (ex : contrarian, ou bruit sur une perception faible) —
    // dans ce cas on force la victoire de l'équipe voulue en ajustant le
    // score minimalement, plutôt que de contredire la logique du profil.
    const drawnWinnerIsHome = home > away;
    if (drawnWinnerIsHome !== winnerIsHome) {
      if (winnerIsHome) home = away + 1;
      else away = home + 1;
    }
  }
  return { home, away };
}

function favori(fixture: FixtureIdentity, ctx: ProfileContext): ExactScorePayload {
  return scorelineFavoringWinner(ctx.favoriPerception, fixture, ctx.rng, "perceived");
}

function contrarian(fixture: FixtureIdentity, ctx: ProfileContext): ExactScorePayload {
  return scorelineFavoringWinner(ctx.favoriPerception, fixture, ctx.rng, "underdog");
}

function expertSimule(fixture: FixtureIdentity, ctx: ProfileContext): ExactScorePayload {
  return scorelineFavoringWinner(ctx.expertPerception, fixture, ctx.rng, "perceived");
}

export const PROFILES: Record<ProfileKey, Profile> = {
  aleatoire,
  favori,
  prudent,
  contrarian,
  expert_simule: expertSimule,
};

export const PROFILE_KEYS: ProfileKey[] = ["aleatoire", "favori", "prudent", "contrarian", "expert_simule"];
