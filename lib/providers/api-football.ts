// Adapter API-Football (api-sports.io, v3).
//
// Priorité n°2 de la stratégie coût (en parallèle de football-data.org,
// voir docs/adr/0003-sport-provider-abstraction.md) : plan Free à tester
// avant d'envisager le plan Pro. Namespace neuf — n'étend PAS
// lib/football/api-football.ts (legacy Canal Cup, couplé en dur à
// WC_LEAGUE_ID=1/WC_SEASON=2026, non touché, non réutilisé).
//
// Capabilities ci-dessous = ce que la documentation publique du plan Free
// annonce — PAS une garantie vérifiée. Voir docs/poc-football-providers-cl-2026-27.md
// pour ce qui a été réellement testé.
//
// Constat factuel de cette session (vérification live, lecture seule) :
// le compte associé à API_FOOTBALL_KEY dans .env.local est SUSPENDU
// (`{"errors":{"access":"Your account is suspended..."}}` sur /status et
// /leagues). Aucune donnée n'a pu être récupérée avec cette clé — voir le
// rapport POC. Ceci est un constat, pas une action prise sur le compte.

import type {
  ProviderCapabilities,
  ProviderCompetition,
  ProviderEvent,
  ProviderEventStatus,
  ProviderParticipant,
  ProviderSeason,
  ProviderStandings,
} from "./sport-provider.ts";
import type {
  FootballEventIncident,
  FootballLineup,
  FootballMatchStatistic,
  FootballProvider,
} from "./football-provider.ts";

const BASE_URL = "https://v3.football.api-sports.io";
const SOURCE = "api-football";

// Ligue des Champions = league id 2 chez API-Football (distinct de
// l'id 1 utilisé par Canal Cup pour la Coupe du Monde).
export const CHAMPIONS_LEAGUE_LEAGUE_ID = 2;

function headers(): HeadersInit {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new Error(
      "[api-football] API_FOOTBALL_KEY manquant — voir .env.local.example. " +
        "Aucune clé souscrite/dépensée par ce code."
    );
  }
  return { "x-apisports-key": key };
}

function mapStatus(short: string): ProviderEventStatus {
  const live = new Set(["1H", "2H", "HT", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);
  const finished = new Set(["FT", "AET", "PEN"]);
  const postponed = new Set(["PST", "SUSP", "INT"]);
  const cancelled = new Set(["CANC", "ABD", "AWD", "WO"]);
  if (finished.has(short)) return "finished";
  if (cancelled.has(short)) return "cancelled";
  if (postponed.has(short)) return "postponed";
  if (live.has(short)) return "live";
  return "scheduled";
}

// Plan Free API-Football : d'après la doc publique, couvre fixtures/
// events/lineups/statistics mais avec des quotas et des restrictions de
// compétitions/saisons selon le plan — À CONFIRMER par le POC, jamais
// déduit de la doc seule.
export const apiFootballCapabilities: ProviderCapabilities = {
  competitions: true,
  seasons: true,
  participants: true,
  fixtures: true,
  status: true,
  live: true,
  scores: true,
  standings: true,
  events: true,
  lineups: true,
  statistics: true,
};

async function getJson(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

export class ApiFootballProvider implements FootballProvider {
  readonly id = SOURCE;
  readonly sport = "football" as const;
  readonly capabilities = apiFootballCapabilities;

  async getCompetitions(): Promise<ProviderCompetition[]> {
    const json = await getJson(`/leagues?id=${CHAMPIONS_LEAGUE_LEAGUE_ID}`);
    const response = json?.response ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.map((r: any) => ({
      source: SOURCE,
      external_id: String(r.league?.id),
      name: r.league?.name,
      metadata: { type: r.league?.type, country: r.country?.name },
    }));
  }

  async getSeasons(competitionExternalId: string): Promise<ProviderSeason[]> {
    const json = await getJson(`/leagues?id=${CHAMPIONS_LEAGUE_LEAGUE_ID}`);
    const response = json?.response?.[0];
    const seasons = response?.seasons ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return seasons.map((s: any) => ({
      source: SOURCE,
      external_id: String(s.year),
      competition_external_id: competitionExternalId,
      label: String(s.year),
      starts_at: s.start,
      ends_at: s.end,
    }));
  }

  async getParticipants(seasonExternalId: string): Promise<ProviderParticipant[]> {
    const json = await getJson(
      `/teams?league=${CHAMPIONS_LEAGUE_LEAGUE_ID}&season=${seasonExternalId}`
    );
    const response = json?.response ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.map((r: any) => ({
      source: SOURCE,
      external_id: String(r.team?.id),
      type: "team" as const,
      name: r.team?.name,
      country: r.team?.country,
      logo_url: r.team?.logo,
    }));
  }

  async getEvents(seasonExternalId: string): Promise<ProviderEvent[]> {
    const json = await getJson(
      `/fixtures?league=${CHAMPIONS_LEAGUE_LEAGUE_ID}&season=${seasonExternalId}`
    );
    const response = json?.response ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.map((r: any) => ({
      source: SOURCE,
      external_id: String(r.fixture?.id),
      season_external_id: seasonExternalId,
      starts_at: r.fixture?.date,
      venue: r.fixture?.venue?.name,
      status: mapStatus(r.fixture?.status?.short),
      stage: r.league?.round,
      participants: [
        { participant_external_id: String(r.teams?.home?.id), role: "home" },
        { participant_external_id: String(r.teams?.away?.id), role: "away" },
      ],
      result:
        r.goals?.home != null
          ? { home_score: r.goals.home, away_score: r.goals.away }
          : undefined,
    }));
  }

  async getStandings(seasonExternalId: string): Promise<ProviderStandings[]> {
    const json = await getJson(
      `/standings?league=${CHAMPIONS_LEAGUE_LEAGUE_ID}&season=${seasonExternalId}`
    );
    const groups = json?.response?.[0]?.league?.standings ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return groups.map((rows: any[], i: number) => ({
      season_external_id: seasonExternalId,
      group: groups.length > 1 ? `Group ${i + 1}` : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: rows.map((row: any) => ({
        participant_external_id: String(row.team?.id),
        position: row.rank,
        points: row.points,
        played: row.all?.played,
        won: row.all?.win,
        drawn: row.all?.draw,
        lost: row.all?.lose,
        extra: { goals_for: row.all?.goals?.for, goals_against: row.all?.goals?.against },
      })),
    }));
  }

  async getEventIncidents(eventExternalId: string): Promise<FootballEventIncident[]> {
    const json = await getJson(`/fixtures/events?fixture=${eventExternalId}`);
    const response = json?.response ?? [];
    const typeMap: Record<string, string> = {
      Goal: "goal",
      Card: "yellow_card",
      subst: "substitution",
      Var: "var",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.map((r: any, i: number) => ({
      source: SOURCE,
      external_id: `${eventExternalId}-${i}`,
      event_external_id: eventExternalId,
      minute: r.time?.elapsed ?? null,
      type: (typeMap[r.type] ?? "goal") as FootballEventIncident["type"],
      participant_external_id: String(r.team?.id),
      player_name: r.player?.name,
      detail: r.detail,
    }));
  }

  async getLineups(eventExternalId: string): Promise<FootballLineup[]> {
    const json = await getJson(`/fixtures/lineups?fixture=${eventExternalId}`);
    const response = json?.response ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.map((r: any) => ({
      event_external_id: eventExternalId,
      participant_external_id: String(r.team?.id),
      formation: r.formation,
      coach_name: r.coach?.name,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      players: (r.startXI ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((p: any) => ({
          player_name: p.player?.name,
          shirt_number: p.player?.number,
          position: p.player?.pos,
          is_starting: true,
        }))
        .concat(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (r.substitutes ?? []).map((p: any) => ({
            player_name: p.player?.name,
            shirt_number: p.player?.number,
            position: p.player?.pos,
            is_starting: false,
          }))
        ),
    }));
  }

  async getStatistics(eventExternalId: string): Promise<FootballMatchStatistic[]> {
    const json = await getJson(`/fixtures/statistics?fixture=${eventExternalId}`);
    const response = json?.response ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return response.flatMap((r: any) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r.statistics ?? []).map((s: any) => ({
        event_external_id: eventExternalId,
        participant_external_id: String(r.team?.id),
        stat_type: s.type,
        value: s.value ?? "",
      }))
    );
  }
}

export const apiFootball = new ApiFootballProvider();
