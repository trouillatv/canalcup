// Adapter football-data.org (https://www.football-data.org, API v4).
//
// Priorité n°1 de la stratégie coût (voir docs/adr/0003-sport-provider-abstraction.md) :
// à tester en premier pour la Ligue des Champions avant d'envisager un plan
// payant ailleurs. Lecture seule, aucun appel d'écriture n'existe côté API.
//
// Capabilities ci-dessous = ce que la documentation publique du plan Free
// annonce (v4, décembre 2025) — PAS une garantie vérifiée. Voir le rapport
// POC (docs/poc-football-providers-cl-2026-27.md) pour ce qui a
// effectivement été testé : au moment de l'écriture, aucune clé
// FOOTBALL_DATA_ORG_API_KEY n'est configurée localement, donc rien n'a pu
// être vérifié pour ce provider — capabilities déclarées "sous réserve".

import type {
  ProviderCapabilities,
  ProviderCompetition,
  ProviderEvent,
  ProviderEventStatus,
  ProviderParticipant,
  ProviderSeason,
  ProviderStandings,
} from "./sport-provider.ts";
import type { FootballProvider } from "./football-provider.ts";

const BASE_URL = "https://api.football-data.org/v4";
const SOURCE = "football-data.org";

// Champions League = code "CL" chez football-data.org (pas un id numérique).
export const CHAMPIONS_LEAGUE_CODE = "CL";

function headers(): HeadersInit {
  const token = process.env.FOOTBALL_DATA_ORG_API_KEY;
  if (!token) {
    throw new Error(
      "[football-data-org] FOOTBALL_DATA_ORG_API_KEY manquant — voir .env.local.example. " +
        "Aucune clé souscrite/dépensée par ce code ; à créer manuellement sur football-data.org (plan Free)."
    );
  }
  return { "X-Auth-Token": token };
}

function mapStatus(status: string): ProviderEventStatus {
  const map: Record<string, ProviderEventStatus> = {
    SCHEDULED: "scheduled",
    TIMED: "scheduled",
    IN_PLAY: "live",
    PAUSED: "live",
    FINISHED: "finished",
    SUSPENDED: "postponed",
    POSTPONED: "postponed",
    CANCELLED: "cancelled",
    AWARDED: "finished",
  };
  return map[status] ?? "scheduled";
}

export const footballDataOrgCapabilities: ProviderCapabilities = {
  competitions: true,
  seasons: true,
  participants: true,
  fixtures: true,
  status: true,
  // Scores live existent sur le plan Free, mais pas de flux temps réel
  // poussé — à confirmer par le POC avant de s'appuyer dessus pour un
  // affichage "minute par minute".
  live: false,
  scores: true,
  standings: true,
  // Non documentés comme disponibles sur le plan Free — à confirmer.
  events: false,
  lineups: false,
  statistics: false,
};

export class FootballDataOrgProvider implements FootballProvider {
  readonly id = SOURCE;
  readonly sport = "football" as const;
  readonly capabilities = footballDataOrgCapabilities;

  async getCompetitions(): Promise<ProviderCompetition[]> {
    const res = await fetch(`${BASE_URL}/competitions/${CHAMPIONS_LEAGUE_CODE}`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    return [
      {
        source: SOURCE,
        external_id: String(json.id),
        name: json.name,
        metadata: { code: json.code, area: json.area?.name },
      },
    ];
  }

  async getSeasons(competitionExternalId: string): Promise<ProviderSeason[]> {
    const res = await fetch(`${BASE_URL}/competitions/${CHAMPIONS_LEAGUE_CODE}`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    const seasons = json.seasons ?? (json.currentSeason ? [json.currentSeason] : []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return seasons.map((s: any) => ({
      source: SOURCE,
      external_id: String(s.id),
      competition_external_id: competitionExternalId,
      label: `${new Date(s.startDate).getFullYear()}-${new Date(s.endDate).getFullYear()}`,
      starts_at: s.startDate,
      ends_at: s.endDate,
    }));
  }

  async getParticipants(): Promise<ProviderParticipant[]> {
    const res = await fetch(`${BASE_URL}/competitions/${CHAMPIONS_LEAGUE_CODE}/teams`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.teams ?? []).map((t: any) => ({
      source: SOURCE,
      external_id: String(t.id),
      type: "team" as const,
      name: t.name,
      short_name: t.shortName,
      country: t.area?.name,
      logo_url: t.crest,
    }));
  }

  async getEvents(): Promise<ProviderEvent[]> {
    const res = await fetch(`${BASE_URL}/competitions/${CHAMPIONS_LEAGUE_CODE}/matches`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.matches ?? []).map((m: any) => ({
      source: SOURCE,
      external_id: String(m.id),
      season_external_id: String(m.season?.id ?? ""),
      starts_at: m.utcDate,
      status: mapStatus(m.status),
      stage: m.stage,
      matchday: m.matchday ?? undefined,
      participants: [
        { participant_external_id: String(m.homeTeam?.id), role: "home" },
        { participant_external_id: String(m.awayTeam?.id), role: "away" },
      ],
      result:
        m.score?.fullTime?.home != null
          ? { home_score: m.score.fullTime.home, away_score: m.score.fullTime.away }
          : undefined,
    }));
  }

  async getStandings(): Promise<ProviderStandings[]> {
    const res = await fetch(`${BASE_URL}/competitions/${CHAMPIONS_LEAGUE_CODE}/standings`, { headers: headers() });
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.standings ?? []).map((group: any) => ({
      season_external_id: String(json.season?.id ?? ""),
      group: group.group ?? group.type,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: (group.table ?? []).map((row: any) => ({
        participant_external_id: String(row.team?.id),
        position: row.position,
        points: row.points,
        played: row.playedGames,
        won: row.won,
        drawn: row.draw,
        lost: row.lost,
        extra: { goals_for: row.goalsFor, goals_against: row.goalsAgainst },
      })),
    }));
  }
}

export const footballDataOrg = new FootballDataOrgProvider();
