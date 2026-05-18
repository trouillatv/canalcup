-- Canal Cup — Schéma Supabase
-- À exécuter dans l'éditeur SQL de ton projet Supabase

-- Extensions
create extension if not exists "uuid-ossp";

-- =====================
-- USERS (profil étendu)
-- =====================
create table if not exists public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  football_level text not null default 'ambiance' check (football_level in ('expert', 'amateur', 'ambiance')),
  team_id uuid,
  created_at timestamptz not null default now()
);

-- =========
-- TEAMS
-- =========
create table if not exists public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slogan text not null,
  logo_url text,
  total_points int not null default 0,
  reputation_label text not null default 'Équipe mystérieuse',
  created_at timestamptz not null default now()
);

alter table public.users add constraint fk_users_team foreign key (team_id) references public.teams(id);

-- =========
-- MATCHES
-- =========
create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  competition text not null default 'Coupe du Monde 2026',
  team_a text not null,
  team_b text not null,
  flag_a text,
  flag_b text,
  starts_at timestamptz not null,
  channel text not null default 'beIN Sports',
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'finished')),
  score_a int,
  score_b int,
  is_match_of_week boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============
-- PREDICTIONS
-- ============
create table if not exists public.predictions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid not null references public.teams(id),
  match_id uuid not null references public.matches(id) on delete cascade,
  prediction_result text not null check (prediction_result in ('A', 'DRAW', 'B')),
  predicted_score_a int,
  predicted_score_b int,
  points_awarded int not null default 0,
  created_at timestamptz not null default now(),
  unique(user_id, match_id)
);

-- =================
-- MORNING BRIEFS
-- =================
create table if not exists public.morning_briefs (
  id uuid primary key default uuid_generate_v4(),
  date date not null unique,
  title text not null,
  body text not null,
  scores_summary text,
  leaderboard_summary text,
  fail_of_day text,
  fun_fact text,
  ai_comment text,
  cartoon_url text,
  created_at timestamptz not null default now()
);

-- ==============
-- REVIVEZ POSTS
-- ==============
create table if not exists public.revivez_posts (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('phrase', 'fail', 'photo', 'babyfoot', 'roast')),
  title text not null,
  content text not null,
  image_url text,
  team_id uuid references public.teams(id),
  user_id uuid references public.users(id),
  votes_count int not null default 0,
  created_at timestamptz not null default now()
);

-- ======
-- VOTES
-- ======
create table if not exists public.votes (
  id uuid primary key default uuid_generate_v4(),
  voter_user_id uuid not null references public.users(id),
  voter_team_id uuid not null references public.teams(id),
  target_type text not null,
  target_id uuid not null,
  target_team_id uuid references public.teams(id),
  value int not null default 1,
  created_at timestamptz not null default now(),
  -- Règle : pas d'auto-vote (voter_team_id != target_team_id)
  check (voter_team_id != target_team_id),
  unique(voter_user_id, target_type, target_id)
);

-- ================
-- BABYFOOT MATCHES
-- ================
create table if not exists public.babyfoot_matches (
  id uuid primary key default uuid_generate_v4(),
  team_a_id uuid not null references public.teams(id),
  team_b_id uuid not null references public.teams(id),
  starts_at timestamptz not null,
  score_a int,
  score_b int,
  status text not null default 'upcoming' check (status in ('upcoming', 'live', 'finished')),
  highlight text,
  created_at timestamptz not null default now()
);

-- ===============
-- QUIZ QUESTIONS
-- ===============
create table if not exists public.quiz_questions (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  answer_a text not null,
  answer_b text not null,
  answer_c text not null,
  answer_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  difficulty text not null default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  category text not null default 'general' check (category in ('foot', 'culture', 'canal', 'general')),
  created_at timestamptz not null default now()
);

-- =============
-- QUIZ ANSWERS
-- =============
create table if not exists public.quiz_answers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id),
  team_id uuid not null references public.teams(id),
  question_id uuid not null references public.quiz_questions(id),
  answer text not null,
  is_correct boolean not null,
  response_time_ms int not null default 0,
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);

-- ==============
-- INBOX EVENTS
-- ==============
create table if not exists public.inbox_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id),
  title text not null,
  message text not null,
  type text not null check (type in ('mention', 'vote_received', 'badge', 'matinale', 'roast')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ===========
-- AI CONTENTS
-- ===========
create table if not exists public.ai_contents (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  prompt text,
  result text not null,
  model text not null default 'gemini-2.0-flash',
  cost_estimate numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

-- =========
-- RLS
-- =========
alter table public.users enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.morning_briefs enable row level security;
alter table public.revivez_posts enable row level security;
alter table public.votes enable row level security;
alter table public.babyfoot_matches enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answers enable row level security;
alter table public.inbox_events enable row level security;
alter table public.ai_contents enable row level security;

-- Lecture publique pour tout le monde authentifié
create policy "Lecture teams" on public.teams for select to authenticated using (true);
create policy "Lecture matches" on public.matches for select to authenticated using (true);
create policy "Lecture morning_briefs" on public.morning_briefs for select to authenticated using (true);
create policy "Lecture revivez_posts" on public.revivez_posts for select to authenticated using (true);
create policy "Lecture babyfoot_matches" on public.babyfoot_matches for select to authenticated using (true);
create policy "Lecture quiz_questions" on public.quiz_questions for select to authenticated using (true);
create policy "Lecture ai_contents" on public.ai_contents for select to authenticated using (true);

-- Lecture de son propre profil
create policy "Lecture users" on public.users for select to authenticated using (true);
create policy "Modification users" on public.users for update to authenticated using (auth.uid() = auth_id);

-- Predictions : lire toutes, insérer la sienne
create policy "Lecture predictions" on public.predictions for select to authenticated using (true);
create policy "Insertion predictions" on public.predictions for insert to authenticated
  with check (user_id in (select id from public.users where auth_id = auth.uid()));
-- Modifier son propre pronostic (l'API fait un upsert → la branche UPDATE
-- doit être autorisée, sinon re-pronostiquer échoue silencieusement).
create policy "Update predictions" on public.predictions for update to authenticated
  using      (user_id in (select id from public.users where auth_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

-- Votes : lire tous, insérer le sien
create policy "Lecture votes" on public.votes for select to authenticated using (true);
create policy "Insertion votes" on public.votes for insert to authenticated
  with check (voter_user_id in (select id from public.users where auth_id = auth.uid()));

-- Quiz answers : lire les siens, insérer
create policy "Lecture quiz_answers" on public.quiz_answers for select to authenticated using (true);
create policy "Insertion quiz_answers" on public.quiz_answers for insert to authenticated
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

-- Inbox : lire la sienne
create policy "Lecture inbox" on public.inbox_events for select to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Update inbox" on public.inbox_events for update to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()));

-- Revivez posts : insérer
create policy "Insertion revivez" on public.revivez_posts for insert to authenticated with check (true);
