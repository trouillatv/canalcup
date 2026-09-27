// Lot 3A (Tâche #28) — étape 1/3 : lecture seule côté fournisseur.
//
// Appelle le provider football actif (getActiveFootballProvider(), voir
// lib/providers/registry.ts — football-data.org par défaut) pour récupérer
// les données réelles Ligue des Champions 2026/27, et les imprime en JSON
// sur stdout. AUCUN accès Supabase ici — uniquement l'API externe, avec la
// clé déjà présente localement (FOOTBALL_DATA_ORG_API_KEY).
//
// La sélection de la saison "courante" est faite par plage de dates
// (starts_at <= maintenant <= ends_at), jamais par un id de saison codé en
// dur — voir resolveCurrentSeason().

import { existsSync, readFileSync } from "node:fs";
import { getActiveFootballProvider } from "../../lib/providers/registry.ts";
import type { ProviderEvent, ProviderSeason } from "../../lib/providers/sport-provider.ts";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvLocal();

export function resolveCurrentSeason(seasons: ProviderSeason[], now: Date): ProviderSeason {
  const withRange = seasons.filter((s) => s.starts_at && s.ends_at);
  const active = withRange.find((s) => new Date(s.starts_at!) <= now && now <= new Date(s.ends_at!));
  if (active) return active;
  throw new Error(
    `[fetch-champions-league] Aucune saison couvrant la date courante (${now.toISOString()}) ` +
      `parmi ${seasons.length} saison(s) renvoyée(s) — abandon, pas de choix par défaut fabriqué.`
  );
}

async function main() {
  const provider = getActiveFootballProvider();
  if (provider.sport !== "football") {
    throw new Error(`[fetch-champions-league] provider actif sport="${provider.sport}", attendu "football"`);
  }

  const competitions = await provider.getCompetitions();
  if (competitions.length !== 1) {
    throw new Error(
      `[fetch-champions-league] ${competitions.length} compétition(s) renvoyée(s) par le provider "${provider.id}", ` +
        "1 attendue (Ligue des Champions) — abandon plutôt que de deviner laquelle importer."
    );
  }
  const competition = competitions[0];

  const seasons = await provider.getSeasons(competition.external_id);
  const now = new Date();
  const season = resolveCurrentSeason(seasons, now);

  const [participants, events] = await Promise.all([
    provider.getParticipants(season.external_id),
    provider.getEvents(season.external_id),
  ]);

  const offSeasonIds = new Set(events.map((e: ProviderEvent) => e.season_external_id));
  if (offSeasonIds.size !== 1 || !offSeasonIds.has(season.external_id)) {
    throw new Error(
      `[fetch-champions-league] getEvents() référence season_external_id=${[...offSeasonIds].join(",")}, ` +
        `attendu exactement "${season.external_id}" — abandon plutôt que de mélanger des saisons.`
    );
  }

  console.log(JSON.stringify({
    fetched_at: now.toISOString(),
    source: provider.id,
    competition,
    season,
    seasons_total_returned_by_provider: seasons.length,
    participants,
    events,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
