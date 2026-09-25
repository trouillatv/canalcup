// Adapter TheSportsDB (thesportsdb.com, v1 JSON API).
//
// Priorité n°4 (source complémentaire optionnelle, PAS prioritaire —
// voir docs/adr/0003-sport-provider-abstraction.md) : utile pour des
// métadonnées (logos, badges) en complément d'un provider "fixtures"
// principal, pas pour remplacer football-data.org/API-Football. Hors
// scope du POC Ligue des Champions 2026/27 de cette session — non testé,
// stub structurel uniquement.
//
// Capabilities ci-dessous reflètent le plan Free public (clé de test
// "3", quotas limités, données historiques/qualité inégale selon la
// compétition) — NON VÉRIFIÉ, voir la note ci-dessus.

import type {
  ProviderCapabilities,
  ProviderCompetition,
  ProviderEvent,
  ProviderEventStatus,
  ProviderParticipant,
  ProviderSeason,
} from "./sport-provider.ts";
import type { FootballProvider } from "./football-provider.ts";

const BASE_URL = "https://www.thesportsdb.com/api/v1/json";
const SOURCE = "thesportsdb";

// Ligue des Champions = league id "4480" chez TheSportsDB.
export const CHAMPIONS_LEAGUE_LEAGUE_ID = "4480";

function apiKey(): string {
  const key = process.env.THESPORTSDB_API_KEY;
  if (!key) {
    throw new Error(
      "[thesportsdb] THESPORTSDB_API_KEY manquant — voir .env.local.example. " +
        "Aucune clé souscrite/dépensée par ce code (la clé de test publique \"3\" existe mais reste un choix explicite, pas un défaut silencieux)."
    );
  }
  return key;
}

function mapStatus(status: string): ProviderEventStatus {
  const s = (status || "").toUpperCase();
  if (s.includes("FT") || s === "MATCH FINISHED") return "finished";
  if (s.includes("POSTP")) return "postponed";
  if (s.includes("CANC")) return "cancelled";
  if (s.includes("LIVE") || s.includes("1H") || s.includes("2H")) return "live";
  return "scheduled";
}

// Non vérifié — capabilities déclarées prudemment (false par défaut) tant
// qu'aucun test réel n'a été fait. À corriger si ce provider est un jour
// activé pour de vrai.
export const theSportsDbCapabilities: ProviderCapabilities = {
  competitions: true,
  seasons: true,
  participants: true,
  fixtures: true,
  status: true,
  live: false,
  scores: true,
  standings: true,
  events: false,
  lineups: false,
  statistics: false,
};

export class TheSportsDbProvider implements FootballProvider {
  readonly id = SOURCE;
  readonly sport = "football" as const;
  readonly capabilities = theSportsDbCapabilities;

  async getCompetitions(): Promise<ProviderCompetition[]> {
    const res = await fetch(`${BASE_URL}/${apiKey()}/lookupleague.php?id=${CHAMPIONS_LEAGUE_LEAGUE_ID}`);
    if (!res.ok) return [];
    const json = await res.json();
    const league = json?.leagues?.[0];
    if (!league) return [];
    return [{ source: SOURCE, external_id: String(league.idLeague), name: league.strLeague }];
  }

  async getSeasons(competitionExternalId: string): Promise<ProviderSeason[]> {
    const res = await fetch(`${BASE_URL}/${apiKey()}/search_all_seasons.php?id=${competitionExternalId}`);
    if (!res.ok) return [];
    const json = await res.json();
    const seasons = json?.seasons ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return seasons.map((s: any) => ({
      source: SOURCE,
      external_id: String(s.strSeason),
      competition_external_id: competitionExternalId,
      label: s.strSeason,
    }));
  }

  async getParticipants(): Promise<ProviderParticipant[]> {
    const res = await fetch(`${BASE_URL}/${apiKey()}/lookup_all_teams.php?id=${CHAMPIONS_LEAGUE_LEAGUE_ID}`);
    if (!res.ok) return [];
    const json = await res.json();
    const teams = json?.teams ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return teams.map((t: any) => ({
      source: SOURCE,
      external_id: String(t.idTeam),
      type: "team" as const,
      name: t.strTeam,
      country: t.strCountry,
      logo_url: t.strTeamBadge,
    }));
  }

  async getEvents(seasonExternalId: string): Promise<ProviderEvent[]> {
    const res = await fetch(
      `${BASE_URL}/${apiKey()}/eventsseason.php?id=${CHAMPIONS_LEAGUE_LEAGUE_ID}&s=${seasonExternalId}`
    );
    if (!res.ok) return [];
    const json = await res.json();
    const events = json?.events ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return events.map((e: any) => ({
      source: SOURCE,
      external_id: String(e.idEvent),
      season_external_id: seasonExternalId,
      starts_at: e.strTimestamp ?? `${e.dateEvent}T${e.strTime ?? "00:00:00"}`,
      venue: e.strVenue,
      status: mapStatus(e.strStatus),
      participants: [
        { participant_external_id: String(e.idHomeTeam), role: "home" },
        { participant_external_id: String(e.idAwayTeam), role: "away" },
      ],
      result:
        e.intHomeScore != null
          ? { home_score: Number(e.intHomeScore), away_score: Number(e.intAwayScore) }
          : undefined,
    }));
  }
}

export const theSportsDb = new TheSportsDbProvider();
