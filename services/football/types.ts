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
  finished_at?: string | null;
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
  player_id?: string; // id API-Football → photo + jointure note
  shirt_number: number;
  position: string;
  formation_position?: string; // grille « ligne:colonne » (ex. "4:1") pour le terrain
  is_starting: boolean;
  role?: string; // repurposé : formation d'équipe (ex. "4-3-3"), identique sur tous les joueurs
}

export interface MatchStat {
  id?: string;
  match_id: string;
  stat_type: string;
  home_value: string;
  away_value: string;
}

export type StatSource = "api-football" | "gemini" | "thesportsdb";

export interface PlayerMatchStat {
  id?: string;
  match_id: string;
  team_side: TeamSide;
  player_name: string;
  player_id?: string;
  rating: number | null; // 0.0–10.0 ; null si non disponible
  goals: number;
  assists: number;
  yellow_cards: number;
  red_cards: number;
  shots: number;
  passes: number;
  tackles: number;
  dribbles: number;
  // Fiche joueur (Forme / Mondial / Indice) : temps de jeu + titularisation,
  // passes clés et duels gagnés. Tous optionnels — l'API ne les remplit pas
  // toujours, l'UI dégrade alors proprement.
  minutes?: number | null;
  started?: boolean | null;
  duels_won?: number | null;
  key_passes?: number | null;
  is_motm: boolean;
  source: StatSource;
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
  playerStats: PlayerMatchStat[];
  standings?: StandingRow[];
}
