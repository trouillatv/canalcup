// Sélection du provider football actif — le seul point du code qui
// connaît le nom d'un adapter concret. Le reste de CANAL Sports (couche
// d'ingestion à venir, routes, jobs) doit appeler getActiveFootballProvider()
// et ne jamais importer un adapter (football-data-org.ts, api-football.ts)
// directement : c'est ce qui rend le changement de fournisseur réversible
// sans couplage métier (voir docs/adr/0003-sport-provider-abstraction.md,
// section "Décision A — provider par défaut").

import type { FootballProvider } from "./football-provider.ts";
import { footballDataOrg } from "./football-data-org.ts";
import { apiFootball } from "./api-football.ts";

const FOOTBALL_PROVIDERS: Record<string, FootballProvider> = {
  "football-data.org": footballDataOrg,
  "api-football": apiFootball,
};

// Décision utilisateur du 2026-09-25 (voir
// docs/poc-football-providers-cl-2026-27.md, conclusion "A") :
// football-data.org Free est le provider football par défaut du MVP.
// api-football reste un adapter disponible (compte actuellement
// suspendu, non bloquant pour le V1) — activable en changeant
// FOOTBALL_PROVIDER, sans toucher au code appelant.
const DEFAULT_FOOTBALL_PROVIDER = "football-data.org";

export function getActiveFootballProvider(): FootballProvider {
  const id = process.env.FOOTBALL_PROVIDER || DEFAULT_FOOTBALL_PROVIDER;
  const provider = FOOTBALL_PROVIDERS[id];
  if (!provider) {
    throw new Error(
      `[providers] FOOTBALL_PROVIDER="${id}" inconnu. Valeurs valides : ${Object.keys(FOOTBALL_PROVIDERS).join(", ")}.`
    );
  }
  return provider;
}

// Périmètre données V1 (même décision du 2026-09-25) : la future couche
// d'ingestion doit se limiter à ces capabilities pour le MVP CANAL
// Sports, même si le provider actif en déclare davantage.
// events/lineups/statistics sont explicitement HORS MVP — à ne pas
// simuler, scraper, ni obtenir via une souscription supplémentaire tant
// que ce périmètre n'a pas été révisé explicitement par l'utilisateur.
export const V1_FOOTBALL_CAPABILITIES = [
  "competitions",
  "seasons",
  "participants",
  "fixtures",
  "status",
  "scores",
  "standings",
] as const;
