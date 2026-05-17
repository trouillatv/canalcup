// ─────────────────────────────────────────────────────────────────────────────
//  whoscored-adapter.ts  —  EXPÉRIMENTAL, DÉSACTIVÉ PAR DÉFAUT
//
//  WhoScored sert d'INSPIRATION UX/data, PAS de dépendance de production.
//  Scraper WhoScored toutes les 5 min pendant le tournoi = risque de blocage,
//  de casse, contractuel et de maintenance élevée. Cet adaptateur n'est donc
//  JAMAIS branché dans getFootballProvider() (lib/football/index.ts) et lève
//  une erreur explicite tant que ENABLE_WHOSCORED_EXPERIMENT !== "true".
//
//  Aucune logique de scraping n'est implémentée ici volontairement. Ce fichier
//  est un point d'extension contrôlé : si un jour un accès légitime existe
//  (API officielle, licence Opta/Stats Perform), l'implémentation viendra ici
//  sans toucher au reste de l'app (interface FootballProvider stable).
// ─────────────────────────────────────────────────────────────────────────────

import type { FootballProvider, LiveMatch, MatchDetail } from "./provider";

export function isWhoScoredExperimentEnabled(): boolean {
  return process.env.ENABLE_WHOSCORED_EXPERIMENT === "true";
}

const DISABLED_MSG =
  "[whoscored-adapter] désactivé. C'est un adaptateur expérimental, jamais " +
  "actif en production. Mettre ENABLE_WHOSCORED_EXPERIMENT=true uniquement " +
  "en environnement de test, et seulement avec une source de données légitime.";

export class WhoScoredAdapter implements FootballProvider {
  constructor() {
    if (!isWhoScoredExperimentEnabled()) {
      throw new Error(DISABLED_MSG);
    }
    // Garde-fou : même flag activé, aucune implémentation de scraping fournie.
    console.warn(
      "[whoscored-adapter] flag activé mais aucune implémentation : " +
        "utilisez TheSportsDB / API-Football comme provider principal."
    );
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    throw new Error(DISABLED_MSG);
  }

  async getMatchDetail(): Promise<MatchDetail | null> {
    throw new Error(DISABLED_MSG);
  }

  async getUpcomingMatches(): Promise<LiveMatch[]> {
    throw new Error(DISABLED_MSG);
  }
}
