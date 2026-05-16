// API-Football (api-sports.io) provider implementation
// Free plan: 100 req/day — always go through cache, never call directly from frontend

import type {
  FootballProvider, LiveMatch, MatchDetail, MatchEvent,
  MatchLineup, MatchStat, LineupPlayer, MatchStatus,
} from "./provider";

const BASE_URL = "https://v3.football.api-sports.io";
const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

function headers() {
  return {
    "x-apisports-key": process.env.API_FOOTBALL_KEY!,
    "Content-Type": "application/json",
  };
}

function mapStatus(short: string): MatchStatus {
  const map: Record<string, MatchStatus> = {
    NS: "upcoming", TBD: "upcoming",
    "1H": "live", "2H": "live", ET: "live", P: "live", BT: "live",
    HT: "halftime",
    FT: "finished", AET: "finished", PEN: "finished",
    PST: "postponed", SUSP: "postponed", ABD: "postponed", AWD: "finished",
  };
  return map[short] ?? "upcoming";
}

function mapFlag(country: string): string {
  const flags: Record<string, string> = {
    France: "🇫🇷", Brazil: "🇧🇷", Argentina: "🇦🇷", Spain: "🇪🇸",
    Portugal: "🇵🇹", Germany: "🇩🇪", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Netherlands: "🇳🇱",
    Belgium: "🇧🇪", Morocco: "🇲🇦", Senegal: "🇸🇳", Japan: "🇯🇵",
    "South-Korea": "🇰🇷", USA: "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽",
    Uruguay: "🇺🇾", Colombia: "🇨🇴", Ecuador: "🇪🇨", Croatia: "🇭🇷",
    Switzerland: "🇨🇭", Denmark: "🇩🇰", Serbia: "🇷🇸", Poland: "🇵🇱",
    Australia: "🇦🇺", Iran: "🇮🇷", "Saudi-Arabia": "🇸🇦", Qatar: "🇶🇦",
    Nigeria: "🇳🇬", Ghana: "🇬🇭", "Ivory-Coast": "🇨🇮", Cameroon: "🇨🇲",
    Algeria: "🇩🇿", Tunisia: "🇹🇳", Egypt: "🇪🇬",
  };
  return flags[country] ?? "🏳️";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fixtureToLiveMatch(f: any): LiveMatch {
  return {
    external_id: f.fixture.id,
    home_team: f.teams.home.name,
    away_team: f.teams.away.name,
    home_flag: mapFlag(f.teams.home.name),
    away_flag: mapFlag(f.teams.away.name),
    status: mapStatus(f.fixture.status.short),
    minute: f.fixture.status.elapsed ?? null,
    score_home: f.goals.home ?? 0,
    score_away: f.goals.away ?? 0,
    kickoff_at: f.fixture.date,
    channel: "",
    venue: f.fixture.venue?.name ?? "",
    referee: f.fixture.referee ?? "",
    competition: f.league.name,
    phase: f.league.round ?? "",
  };
}

export class ApiFootballProvider implements FootballProvider {
  async getLiveMatches(): Promise<LiveMatch[]> {
    const res = await fetch(
      `${BASE_URL}/fixtures?live=all&league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
      { headers: headers(), next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.response ?? []).map(fixtureToLiveMatch);
  }

  async getMatchDetail(externalId: number): Promise<MatchDetail | null> {
    const [fixtureRes, eventsRes, lineupsRes, statsRes] = await Promise.all([
      fetch(`${BASE_URL}/fixtures?id=${externalId}`, { headers: headers(), next: { revalidate: 60 } }),
      fetch(`${BASE_URL}/fixtures/events?fixture=${externalId}`, { headers: headers(), next: { revalidate: 60 } }),
      fetch(`${BASE_URL}/fixtures/lineups?fixture=${externalId}`, { headers: headers(), next: { revalidate: 300 } }),
      fetch(`${BASE_URL}/fixtures/statistics?fixture=${externalId}`, { headers: headers(), next: { revalidate: 60 } }),
    ]);

    const fixtureJson = await fixtureRes.json();
    if (!fixtureJson.response?.length) return null;

    const match = fixtureToLiveMatch(fixtureJson.response[0]);

    // Events
    const eventsJson = await eventsRes.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: MatchEvent[] = (eventsJson.response ?? []).map((e: any) => ({
      minute: e.time.elapsed,
      type: mapEventType(e.type, e.detail),
      player_name: e.player?.name ?? "",
      team: e.team.id === fixtureJson.response[0].teams.home.id ? "home" : "away",
      detail: e.detail ?? "",
    }));

    // Lineups
    const lineupsJson = await lineupsRes.json();
    let lineups = null;
    if (lineupsJson.response?.length >= 2) {
      lineups = {
        home: parseLineup(lineupsJson.response[0], "home"),
        away: parseLineup(lineupsJson.response[1], "away"),
      };
    }

    // Stats
    const statsJson = await statsRes.json();
    const stats: MatchStat[] = [];
    if (statsJson.response?.length >= 2) {
      const homeStats = statsJson.response[0].statistics;
      const awayStats = statsJson.response[1].statistics;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      homeStats.forEach((s: any, i: number) => {
        stats.push({
          stat_type: s.type,
          home_value: String(s.value ?? 0),
          away_value: String(awayStats[i]?.value ?? 0),
        });
      });
    }

    return { match, events, lineups, stats };
  }

  async getUpcomingMatches(leagueId: number, season: number): Promise<LiveMatch[]> {
    const res = await fetch(
      `${BASE_URL}/fixtures?league=${leagueId}&season=${season}&status=NS&next=20`,
      { headers: headers(), next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    return (json.response ?? []).map(fixtureToLiveMatch);
  }
}

function mapEventType(type: string, detail: string): MatchEvent["type"] {
  if (type === "Goal") return "goal";
  if (type === "Card" && detail === "Yellow Card") return "yellow_card";
  if (type === "Card" && detail?.includes("Red")) return "red_card";
  if (type === "subst") return "substitution";
  if (type === "Var") return "var";
  if (detail === "Missed Penalty") return "penalty_missed";
  return "goal";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseLineup(raw: any, side: "home" | "away"): MatchLineup {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const starters: LineupPlayer[] = (raw.startXI ?? []).map((p: any) => ({
    player_name: p.player.name,
    shirt_number: p.player.number ?? 0,
    position: p.player.pos ?? "",
    is_starting: true,
  }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subs: LineupPlayer[] = (raw.substitutes ?? []).map((p: any) => ({
    player_name: p.player.name,
    shirt_number: p.player.number ?? 0,
    position: p.player.pos ?? "",
    is_starting: false,
  }));
  return {
    team: side,
    formation: raw.formation ?? "",
    coach: raw.coach?.name ?? "",
    players: [...starters, ...subs],
  };
}

export const apiFootball = new ApiFootballProvider();
