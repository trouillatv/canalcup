// ─── Enums ────────────────────────────────────────────────────────────────────

export type FootballLevel = "expert" | "amateur" | "ambiance";
export type MatchStatus = "upcoming" | "live" | "finished";
export type PredictionResult = "A" | "DRAW" | "B";
export type RevivezType = "phrase" | "fail" | "photo" | "babyfoot" | "roast";
export type InboxEventType = "mention" | "vote_received" | "badge" | "matinale" | "roast";
export type BabyFootStatus = "upcoming" | "live" | "finished";
export type QuizDifficulty = "easy" | "medium" | "hard";
export type QuizCategory = "foot" | "culture" | "canal" | "general";
export type AIContentType = "morning_brief" | "team_roast" | "coach_comment" | "fail_caption";
export type UserRole = "user" | "admin" | "event_admin" | "super_admin";
export type TeamRole = "captain" | "member";
export type TournamentPhase = "group_stage" | "round_of_16" | "quarter_final" | "semi_final" | "final";

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  emoji: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  slogan: string;
  logo_url?: string;
  color: string;
  total_points: number;
  reputation_label: string;
  created_at: string;
  members?: User[];
}

export interface User {
  id: string;
  auth_id?: string;
  name: string;
  display_name?: string;
  user_slug?: string;
  email: string;
  avatar_url?: string;
  football_level: FootballLevel;
  team_id?: string;
  team_role: TeamRole;
  service_id?: string;
  profile_completed: boolean;
  onboarding_step: number;
  last_login_at?: string;
  updated_at?: string;
  created_at: string;
  // Relations
  team?: Team;
  service?: Service;
}

export interface AllowlistUser {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

// Vue admin combinée (allowlist + profile)
export interface AdminUserView {
  email: string;
  role: UserRole;
  is_active: boolean;
  allowlist_created_at: string;
  // depuis public.users
  display_name?: string;
  user_slug?: string;
  service_id?: string;
  service?: Service;
  football_level?: FootballLevel;
  profile_completed: boolean;
  last_login_at?: string;
  // depuis auth.users (via service_role)
  auth_last_sign_in?: string;
}

export interface AdminLog {
  id: string;
  admin_email: string;
  action: string;
  target_email?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
}

// ─── Match & Predictions ──────────────────────────────────────────────────────

export interface MatchOdds {
  odds_a: number;
  odds_draw: number;
  odds_b: number;
}

export interface Match {
  id: string;
  competition: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  starts_at: string;
  channel: string;
  status: MatchStatus;
  score_a?: number;
  score_b?: number;
  is_match_of_week: boolean;
  odds?: MatchOdds;
}

export interface Prediction {
  id: string;
  user_id: string;
  team_id: string;
  match_id: string;
  prediction_result: PredictionResult;
  predicted_score_a?: number;
  predicted_score_b?: number;
  points_awarded: number;
  created_at: string;
}

export interface PredictionTrend {
  match_id: string;
  total: number;
  votes_a: number;
  votes_draw: number;
  votes_b: number;
  pct_a: number;
  pct_draw: number;
  pct_b: number;
}

// ─── Content ──────────────────────────────────────────────────────────────────

export interface MorningBrief {
  id: string;
  date: string;
  title: string;
  body: string;
  scores_summary: string;
  leaderboard_summary: string;
  fail_of_day: string;
  fun_fact: string;
  ai_comment: string;
  cartoon_url?: string;
  created_at: string;
}

export interface RevivezPost {
  id: string;
  type: RevivezType;
  title: string;
  content: string;
  image_url?: string;
  team_id?: string;
  user_id?: string;
  votes_count: number;
  created_at: string;
  team?: Team;
}

export interface Vote {
  id: string;
  voter_user_id: string;
  voter_team_id: string;
  target_type: string;
  target_id: string;
  target_team_id: string;
  value: number;
  created_at: string;
}

export interface BabyFootMatch {
  id: string;
  team_a_id: string;
  team_b_id: string;
  starts_at: string;
  score_a?: number;
  score_b?: number;
  status: BabyFootStatus;
  highlight?: string;
  created_at: string;
  team_a?: Team;
  team_b?: Team;
}

export interface QuizQuestion {
  id: string;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  difficulty: QuizDifficulty;
  category: QuizCategory;
}

export interface QuizAnswer {
  id: string;
  user_id: string;
  team_id: string;
  question_id: string;
  answer: string;
  is_correct: boolean;
  response_time_ms: number;
  points_awarded: number;
  created_at: string;
}

export interface InboxEvent {
  id: string;
  user_id: string;
  team_id?: string;
  title: string;
  message: string;
  type: InboxEventType;
  is_read: boolean;
  created_at: string;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardRow {
  team: Team;
  points_predictions: number;
  points_quiz: number;
  points_babyfoot: number;
  points_votes: number;
  total: number;
  rank: number;
}
