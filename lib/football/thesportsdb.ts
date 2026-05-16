// TheSportsDB provider — free, no API key, no rate limit
// Docs: https://www.thesportsdb.com/api.php
// World Cup 2026 league ID: 4429

import type { FootballProvider, LiveMatch, MatchDetail, MatchEvent, MatchStatus } from "./provider";
import { toFrench } from "./team-names";

const BASE = "https://www.thesportsdb.com/api/v1/json/3";
const WC_LEAGUE_ID = "4429";

const FLAGS: Record<string, string> = {
  // Americas
  USA: "🇺🇸", "United States": "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽",
  Brazil: "🇧🇷", Argentina: "🇦🇷", Uruguay: "🇺🇾", Colombia: "🇨🇴",
  Ecuador: "🇪🇨", Paraguay: "🇵🇾", Peru: "🇵🇪", Chile: "🇨🇱",
  Venezuela: "🇻🇪", Bolivia: "🇧🇴", Jamaica: "🇯🇲", Haiti: "🇭🇹",
  Panama: "🇵🇦", "Costa Rica": "🇨🇷", Honduras: "🇭🇳", "El Salvador": "🇸🇻",
  // Europe
  France: "🇫🇷", Spain: "🇪🇸", Germany: "🇩🇪", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Portugal: "🇵🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪", Italy: "🇮🇹",
  Switzerland: "🇨🇭", Croatia: "🇭🇷", Denmark: "🇩🇰", Sweden: "🇸🇪",
  Norway: "🇳🇴", Poland: "🇵🇱", Serbia: "🇷🇸", Ukraine: "🇺🇦",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Czech Republic": "🇨🇿",
  Slovakia: "🇸🇰", Hungary: "🇭🇺", Romania: "🇷🇴", Austria: "🇦🇹",
  "Bosnia-Herzegovina": "🇧🇦", Slovenia: "🇸🇮", Albania: "🇦🇱",
  Greece: "🇬🇷", Turkey: "🇹🇷", Georgia: "🇬🇪", Iceland: "🇮🇸",
  // Africa
  Morocco: "🇲🇦", Senegal: "🇸🇳", Nigeria: "🇳🇬", Ghana: "🇬🇭",
  "Ivory Coast": "🇨🇮", Cameroon: "🇨🇲", Algeria: "🇩🇿", Tunisia: "🇹🇳",
  Egypt: "🇪🇬", "South Africa": "🇿🇦", Mali: "🇲🇱", Gabon: "🇬🇦",
  "Cape Verde": "🇨🇻", "DR Congo": "🇨🇩", Benin: "🇧🇯",
  // Asia / Pacific
  Japan: "🇯🇵", "South Korea": "🇰🇷", "Saudi Arabia": "🇸🇦", Iran: "🇮🇷",
  Qatar: "🇶🇦", Australia: "🇦🇺", "New Zealand": "🇳🇿",
  Indonesia: "🇮🇩", Uzbekistan: "🇺🇿",
  // Caribbean / other
  "Curaçao": "🇨🇼", "Trinidad and Tobago": "🇹🇹", Cuba: "🇨🇺",
};

function flag(name: string): string {
  return FLAGS[name] ?? "🏳️";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapStatus(e: any): MatchStatus {
  const s = e.strStatus ?? "";
  if (s === "Match Finished" || s === "FT" || s === "AOT" || s === "Pen") return "finished";
  if (s === "HT" || s === "Half Time") return "halftime";
  if (s === "1H" || s === "2H" || s === "ET" || s === "In Progress") return "live";
  if (s === "Postponed" || s === "Cancelled") return "postponed";
  return "upcoming";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function eventToLiveMatch(e: any): LiveMatch {
  const kickoffDate = e.dateEvent ?? "";
  const kickoffTime = e.strTime ?? "00:00:00";
  const kickoff_at = kickoffDate ? `${kickoffDate}T${kickoffTime}Z` : new Date().toISOString();
  const homeFr = toFrench(e.strHomeTeam ?? "");
  const awayFr = toFrench(e.strAwayTeam ?? "");
  return {
    external_id: parseInt(e.idEvent, 10),
    home_team: homeFr,
    away_team: awayFr,
    home_flag: flag(e.strHomeTeam ?? ""),
    away_flag: flag(e.strAwayTeam ?? ""),
    status: mapStatus(e),
    minute: e.intProgress ? parseInt(e.intProgress, 10) : null,
    score_home: e.intHomeScore !== null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : 0,
    score_away: e.intAwayScore !== null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : 0,
    kickoff_at,
    channel: e.strTVStation ?? "",
    venue: e.strVenue ?? "",
    referee: "",
    competition: e.strLeague ?? "FIFA World Cup 2026",
    phase: e.strRound ?? e.intRound ?? "",
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseEvents(timeline: any[], homeId: string): MatchEvent[] {
  if (!Array.isArray(timeline)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return timeline.map((t: any) => {
    const type = mapEventType(t.strType ?? "", t.strDetail ?? "");
    return {
      minute: parseInt(t.intProgress ?? "0", 10),
      type,
      player_name: t.strPlayer ?? "",
      team: t.idTeam === homeId ? "home" : "away",
      detail: t.strDetail ?? "",
    };
  });
}

function mapEventType(type: string, detail: string): MatchEvent["type"] {
  const t = type.toLowerCase();
  const d = detail.toLowerCase();
  if (t.includes("goal")) return "goal";
  if (t.includes("yellow")) return "yellow_card";
  if (t.includes("red")) return "red_card";
  if (t.includes("sub")) return "substitution";
  if (t.includes("var")) return "var";
  if (d.includes("missed") && d.includes("pen")) return "penalty_missed";
  return "goal";
}

export class TheSportsDBProvider implements FootballProvider {
  private async fetchJSON(url: string) {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return res.json();
  }

  async getLiveMatches(): Promise<LiveMatch[]> {
    // TheSportsDB has no live endpoint — return today's matches (next + past)
    const [next, past] = await Promise.all([
      this.fetchJSON(`${BASE}/eventsnextleague.php?id=${WC_LEAGUE_ID}`),
      this.fetchJSON(`${BASE}/eventspastleague.php?id=${WC_LEAGUE_ID}`),
    ]);
    const events = [
      ...(next?.events ?? []),
      ...(past?.events ?? []).slice(0, 5),
    ];
    return events.map(eventToLiveMatch);
  }

  async getMatchDetail(externalId: number): Promise<MatchDetail | null> {
    const json = await this.fetchJSON(`${BASE}/lookupevent.php?id=${externalId}`);
    if (!json?.events?.length) return null;

    const e = json.events[0];
    const match = eventToLiveMatch(e);

    // Timeline (goals, cards) — available on free tier via lookuptimeline
    const timelineJson = await this.fetchJSON(`${BASE}/lookuptimeline.php?id=${externalId}`);
    const events = parseEvents(timelineJson?.timeline ?? [], e.idHomeTeam ?? "");

    return {
      match,
      events,
      lineups: null,  // requires Patreon key
      stats: [],      // requires Patreon key
    };
  }

  async getUpcomingMatches(): Promise<LiveMatch[]> {
    const json = await this.fetchJSON(`${BASE}/eventsnextleague.php?id=${WC_LEAGUE_ID}`);
    return (json?.events ?? []).map(eventToLiveMatch);
  }
}
