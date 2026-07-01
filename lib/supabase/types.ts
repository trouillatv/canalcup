// ─── Enums ────────────────────────────────────────────────────────────────────

export type FootballLevel = "expert" | "amateur" | "ambiance";
export type MatchStatus = "upcoming" | "live" | "halftime" | "finished";
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
export type BonusPredictionType = "winner" | "top_scorer";
export type ChallengeCategory = "challenges" | "social";
export type ChallengeStatus = "upcoming" | "live" | "finished" | "hidden";
export type ChallengeEntryStatus = "pending" | "approved" | "hidden";
export type ScoreCategory = "predictions" | "quiz" | "challenges" | "babyfoot" | "social" | "bonus";
export type ScoreSourceType =
  | "challenge_entry" | "manual_admin" | "quiz_answer"
  | "babyfoot_match" | "prediction" | "vote" | "award";
export type FeedPostType = "ambiance" | "photo" | "chambrage" | "match" | "babyfoot" | "quiz" | "animation" | "robert" | "joker";
export type SocialStatus = "visible" | "hidden";
export type VestiaireChannelType = "general" | "match" | "team" | "animation";
export type ModerationRiskLevel = "low" | "medium" | "high";
export type ModerationReportStatus = "new" | "reviewed" | "ignored";

// ─── Core entities ────────────────────────────────────────────────────────────

export interface Service {
  id: string;
  name: string;
  emoji?: string; // colonne absente en base (décision produit : pas d'emoji services)
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
  // Fuseau d'affichage des horaires de match. Défaut 'Pacific/Noumea'.
  timezone?: string;
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
  external_id?: number;
  competition: string;
  phase?: string;
  stage?: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  starts_at: string;
  channel: string;
  status: MatchStatus;
  minute?: number | null;
  score_a?: number;
  score_b?: number;
  score_ht_a?: number | null;
  score_ht_b?: number | null;
  // Score du temps réglementaire (90'+) — prolongation/TAB exclus. Base le
  // scoring des pronos KO ; null en phase de groupes (= score_a/score_b).
  score_reg_a?: number | null;
  score_reg_b?: number | null;
  // Tirs au but (séance) — départage un KO nul après prolongation. null hors t.a.b.
  pen_a?: number | null;
  pen_b?: number | null;
  is_match_of_week?: boolean;
  is_settled?: boolean;
  finished_at?: string | null;
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

export interface BonusPrediction {
  id: string;
  user_id: string;
  team_id?: string;
  prediction_type: BonusPredictionType;
  predicted_value: string;
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
  round: string;
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
  sub_category?: string;
  explanation?: string;
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

export interface FeedPost {
  id: string;
  user_id?: string | null;
  email?: string | null;
  display_name?: string | null;
  type: FeedPostType;
  context_type?: string | null;
  context_id?: string | null;
  body: string;
  image_url?: string | null;
  status: SocialStatus;
  hidden_at?: string | null;
  hidden_by_email?: string | null;
  created_at: string;
}

export interface VestiaireChannel {
  id: string;
  type: VestiaireChannelType;
  title: string;
  description?: string | null;
  team_id?: string | null;
  match_id?: string | null;
  challenge_id?: string | null;
  is_private: boolean;
  is_active: boolean;
  opens_at?: string | null;
  closes_at?: string | null;
  created_at: string;
}

export interface VestiaireMessage {
  id: string;
  channel_id: string;
  user_id?: string | null;
  email?: string | null;
  display_name?: string | null;
  body: string;
  status: SocialStatus;
  hidden_at?: string | null;
  hidden_by_email?: string | null;
  created_at: string;
}

export interface VestiaireMessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: "🔥" | "😂" | "👏" | "😱";
  created_at: string;
}

export interface ModerationFlaggedItem {
  source: "feed" | "vestiaire";
  id: string;
  author?: string | null;
  channel?: string | null;
  excerpt: string;
  reason: string;
}

export interface ModerationReport {
  id: string;
  window_start: string;
  window_end: string;
  risk_level: ModerationRiskLevel;
  summary: string;
  flagged_items: ModerationFlaggedItem[];
  recommendation?: string | null;
  status: ModerationReportStatus;
  created_at: string;
}

// ─── Challenges & scoring ────────────────────────────────────────────────────

export interface Challenge {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  description: string;
  rules?: string;
  location?: string;
  duration_minutes?: number;
  max_points: number;
  category: ChallengeCategory;
  phase: number;
  status: ChallengeStatus;
  sort_order: number;
  // Phase 2.A : si false → solo (1 participant) ; si true → groupe possible.
  allows_group?: boolean;
  created_at: string;
  // Relations
  entries?: ChallengeEntry[];
}

export interface ChallengeEntry {
  id: string;
  challenge_id: string;
  team_id: string;
  user_id?: string;
  title?: string;
  content?: string;
  image_url?: string;
  points_awarded: number;
  status: ChallengeEntryStatus;
  created_at: string;
  // Relations
  team?: Team;
  challenge?: Challenge;
  // Phase 2.A : participants au sens "groupes par activité". Pour les
  // entries solo, contient 1 ligne (= user_id de l'entry). Pour les
  // entries team-level historiques sans user_id, peut être vide.
  participants?: { user_id: string; user?: { id: string; display_name?: string | null; name?: string | null; team_id?: string | null } | null }[];
}

// Source de scoring générique — toute activité écrit ici (jamais directement
// dans teams.total_points). Sommé par le leaderboard dans une étape ultérieure.
export interface ScoreEvent {
  id: string;
  team_id: string;
  user_id?: string;
  category: ScoreCategory;
  source_type: ScoreSourceType;
  source_id?: string;
  raw_points: number;
  label: string;
  description?: string;
  created_at: string;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

// Pondéré (G2) : `points_*` = BRUT par pilier (tooltip/détail) ; `weighted`
// = contributions pondérées affichées au classement (leur somme = `total`).
// votes = métrique sociale, JAMAIS dans `total`.
export interface LeaderboardRow {
  team: Team;
  points_predictions: number; // brut pronos (predictions seules)
  points_bonus: number; // brut bonus (sous-ensemble du pilier pronostics)
  points_quiz: number; // brut quiz
  points_babyfoot: number; // brut babyfoot
  points_animations: number; // brut animations/challenges/photos (score_events)
  points_votes: number; // brut votes — SOCIAL, hors total principal
  weighted: {
    pronostics: number; // pondéré (predictions + bonus)
    quiz: number;
    babyfoot: number;
    animations: number;
  };
  total: number; // = somme des contributions pondérées
  rank: number;
}

export interface CanalCupEvent {
  id: string;
  type: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  teams?: string[];
  hype_level: number;
  robert_phrase?: string;
  location?: string;
  is_active: boolean;
  created_at: string;
}

// ─── Jokers (module chaos) ───────────────────────────────────────────────────
// Types métier (JokerType, JokerStatus, JokerEffectType) : lib/jokers/catalog.ts

export interface JokerWallet {
  id: string;
  user_id: string;
  joker_type: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface JokerPlay {
  id: string;
  joker_type: string;
  played_by_user_id: string;
  target_user_id?: string | null;
  match_id?: string | null;
  status: string;
  effect_starts_at?: string | null;
  effect_ends_at?: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface JokerEffect {
  id: string;
  joker_play_id: string;
  affected_user_id: string;
  match_id?: string | null;
  effect_type: string;
  starts_at: string;
  ends_at?: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
