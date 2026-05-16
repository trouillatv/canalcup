// Football data provider interface — all providers must implement this

export type MatchStatus = "upcoming" | "live" | "finished" | "halftime" | "postponed";
export type EventType = "goal" | "yellow_card" | "red_card" | "substitution" | "var" | "penalty_missed";

export interface LiveMatch {
  external_id: number;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  status: MatchStatus;
  minute: number | null;
  score_home: number;
  score_away: number;
  kickoff_at: string; // ISO UTC
  channel: string;
  venue: string;
  referee: string;
  competition: string;
  phase: string;
}

export interface MatchEvent {
  minute: number;
  type: EventType;
  player_name: string;
  team: "home" | "away";
  detail: string;
}

export interface LineupPlayer {
  player_name: string;
  shirt_number: number;
  position: string;
  is_starting: boolean;
}

export interface MatchLineup {
  team: "home" | "away";
  formation: string;
  coach: string;
  players: LineupPlayer[];
}

export interface MatchStat {
  stat_type: string;
  home_value: string;
  away_value: string;
}

export interface MatchDetail {
  match: LiveMatch;
  events: MatchEvent[];
  lineups: { home: MatchLineup; away: MatchLineup } | null;
  stats: MatchStat[];
}

export interface FootballProvider {
  getLiveMatches(): Promise<LiveMatch[]>;
  getMatchDetail(externalId: number): Promise<MatchDetail | null>;
  getUpcomingMatches(leagueId: number, season: number): Promise<LiveMatch[]>;
}
