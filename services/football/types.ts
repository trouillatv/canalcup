export type MatchStatus = "upcoming" | "live" | "halftime" | "finished" | "postponed";
export type EventType = "goal" | "yellow_card" | "red_card" | "substitution" | "var" | "penalty" | "penalty_missed";
export type TeamSide = "home" | "away";

export interface FootballMatch {
  id: string;
  external_id: number;
  competition: string;
  phase: string;
  stage?: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a: number | null;
  score_b: number | null;
  status: MatchStatus;
  minute: number | null;
  starts_at: string;
  venue?: string;
  referee?: string;
  channel: string;
  is_featured: boolean;
  updated_at?: string;
}

export interface MatchEvent {
  id?: string;
  match_id: string;
  external_id?: number;
  minute: number;
  extra_minute?: number;
  team_side: TeamSide;
  player_name: string;
  assist_player_name?: string;
  type: EventType;
  detail?: string;
}

export interface LineupPlayer {
  id?: string;
  match_id: string;
  team_side: TeamSide;
  player_name: string;
  shirt_number: number;
  position: string;
  formation_position?: string;
  is_starting: boolean;
  role?: string;
}

export interface MatchStat {
  id?: string;
  match_id: string;
  stat_type: string;
  home_value: string;
  away_value: string;
}

export interface StandingRow {
  team_name: string;
  team_name_fr?: string;
  team_flag?: string;
  group_name: string;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  rank: number;
}

export interface FullMatchDetail {
  match: FootballMatch;
  events: MatchEvent[];
  lineups: {
    home: LineupPlayer[];
    away: LineupPlayer[];
    home_formation?: string;
    away_formation?: string;
    home_coach?: string;
    away_coach?: string;
  } | null;
  stats: MatchStat[];
  standings?: StandingRow[];
}
