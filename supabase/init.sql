-- ============================================================
-- Canal Cup 2026 — INIT COMPLET
-- Copie-colle ce fichier entier dans l'éditeur SQL Supabase
-- et clique Run UNE SEULE FOIS
-- ============================================================

-- 1. Nettoyage (drop dans l'ordre inverse des dépendances)
drop table if exists public.ai_contents cascade;
drop table if exists public.inbox_events cascade;
drop table if exists public.quiz_answers cascade;
drop table if exists public.quiz_questions cascade;
drop table if exists public.babyfoot_matches cascade;
drop table if exists public.votes cascade;
drop table if exists public.revivez_posts cascade;
drop table if exists public.morning_briefs cascade;
drop table if exists public.predictions cascade;
drop table if exists public.matches cascade;
drop table if exists public.users cascade;
drop table if exists public.teams cascade;

-- 2. Extensions
create extension if not exists "uuid-ossp";

-- 3. Tables

create table public.teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slogan text not null,
  logo_url text,
  total_points int not null default 0,
  reputation_label text not null default 'Équipe mystérieuse',
  created_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  auth_id uuid references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  avatar_url text,
  football_level text not null default 'ambiance' check (football_level in ('expert', 'amateur', 'ambiance')),
  team_id uuid references public.teams(id),
  created_at timestamptz not null default now()
);

create table public.matches (
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

create table public.predictions (
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

create table public.morning_briefs (
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

create table public.revivez_posts (
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

create table public.votes (
  id uuid primary key default uuid_generate_v4(),
  voter_user_id uuid not null references public.users(id),
  voter_team_id uuid not null references public.teams(id),
  target_type text not null,
  target_id uuid not null,
  target_team_id uuid references public.teams(id),
  value int not null default 1,
  created_at timestamptz not null default now(),
  check (voter_team_id != target_team_id),
  unique(voter_user_id, target_type, target_id)
);

create table public.babyfoot_matches (
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

create table public.quiz_questions (
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

create table public.quiz_answers (
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

create table public.inbox_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  team_id uuid references public.teams(id),
  title text not null,
  message text not null,
  type text not null check (type in ('mention', 'vote_received', 'badge', 'matinale', 'roast')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_contents (
  id uuid primary key default uuid_generate_v4(),
  type text not null,
  prompt text,
  result text not null,
  model text not null default 'gemini-2.0-flash',
  cost_estimate numeric(10,6) not null default 0,
  created_at timestamptz not null default now()
);

-- 4. RLS
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

create policy "Lecture teams" on public.teams for select to authenticated using (true);
create policy "Lecture matches" on public.matches for select to authenticated using (true);
create policy "Lecture morning_briefs" on public.morning_briefs for select to authenticated using (true);
create policy "Lecture revivez_posts" on public.revivez_posts for select to authenticated using (true);
create policy "Lecture babyfoot_matches" on public.babyfoot_matches for select to authenticated using (true);
create policy "Lecture quiz_questions" on public.quiz_questions for select to authenticated using (true);
create policy "Lecture ai_contents" on public.ai_contents for select to authenticated using (true);
create policy "Lecture users" on public.users for select to authenticated using (true);
create policy "Modification users" on public.users for update to authenticated using (auth.uid() = auth_id);
create policy "Lecture predictions" on public.predictions for select to authenticated using (true);
create policy "Insertion predictions" on public.predictions for insert to authenticated
  with check (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Lecture votes" on public.votes for select to authenticated using (true);
create policy "Insertion votes" on public.votes for insert to authenticated
  with check (voter_user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Lecture quiz_answers" on public.quiz_answers for select to authenticated using (true);
create policy "Insertion quiz_answers" on public.quiz_answers for insert to authenticated
  with check (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Lecture inbox" on public.inbox_events for select to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Update inbox" on public.inbox_events for update to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()));
create policy "Insertion revivez" on public.revivez_posts for insert to authenticated with check (true);

-- 5. Seed — Équipes
insert into public.teams (id, name, slogan, total_points, reputation_label) values
  ('11111111-0000-0000-0000-000000000001', 'Les VARcassés', 'On proteste, donc on existe', 87, 'Experts en frustration constructive'),
  ('11111111-0000-0000-0000-000000000002', 'FC Réunion Inutile', 'On y croit', 72, 'Outsiders perpétuellement confiants'),
  ('11111111-0000-0000-0000-000000000003', 'Goal Average', 'La précision avant tout (parfois)', 61, 'Philosophes du nul');

-- 6. Seed — Matchs
insert into public.matches (id, competition, team_a, team_b, flag_a, flag_b, starts_at, channel, status, score_a, score_b, is_match_of_week) values
  ('22222222-0000-0000-0000-000000000001', 'Coupe du Monde 2026', 'France', 'Brésil', 'FR', 'BR',
   '2026-06-12 14:00:00+00', 'beIN Sports 1', 'finished', 2, 1, true),
  ('22222222-0000-0000-0000-000000000002', 'Coupe du Monde 2026', 'Allemagne', 'Espagne', 'DE', 'ES',
   '2026-06-13 17:00:00+00', 'beIN Sports 2', 'finished', 0, 0, false),
  ('22222222-0000-0000-0000-000000000003', 'Coupe du Monde 2026', 'Argentine', 'Portugal', 'AR', 'PT',
   '2026-06-14 20:00:00+00', 'Canal+ Sport', 'upcoming', null, null, false),
  ('22222222-0000-0000-0000-000000000004', 'Coupe du Monde 2026', 'Maroc', 'Sénégal', 'MA', 'SN',
   '2026-06-15 14:00:00+00', 'beIN Sports 1', 'upcoming', null, null, false),
  ('22222222-0000-0000-0000-000000000005', 'Coupe du Monde 2026', 'Japon', 'Corée du Sud', 'JP', 'KR',
   '2026-06-16 11:00:00+00', 'beIN Sports 3', 'upcoming', null, null, false);

-- 7. Seed — Matinale
insert into public.morning_briefs (id, date, title, body, scores_summary, leaderboard_summary, fail_of_day, fun_fact, ai_comment) values
  ('33333333-0000-0000-0000-000000000001', '2026-06-13',
   'France 2-1 Brésil : le chaos organisé a gagné',
   'La France a battu le Brésil avec deux buts et une quantité raisonnable de VAR. Le FC Réunion Inutile avait parié sur le nul. Comme d''habitude. Les VARcassés, eux, avaient vu juste.',
   'France 2-1 Brésil • Allemagne 0-0 Espagne',
   '1. Les VARcassés (87pts) • 2. FC Réunion Inutile (72pts) • 3. Goal Average (61pts)',
   'Le FC Réunion Inutile a parié sur un nul 1-1. Le football leur a répondu 2-1. C''est proche. Dans un univers parallèle.',
   'Saviez-vous que Canal+ a diffusé son premier match en direct en 1984 ?',
   'Continue comme ça, les VARcassés. Une régularité dans les bons résultats, c''est aussi une forme de talent.');

-- 8. Seed — Revivez
insert into public.revivez_posts (id, type, title, content, team_id, votes_count) values
  ('44444444-0000-0000-0000-000000000001', 'phrase', 'La citation de la semaine',
   '"On avait le bon résultat. Le football, lui, avait une autre idée." — FC Réunion Inutile',
   '11111111-0000-0000-0000-000000000002', 23),
  ('44444444-0000-0000-0000-000000000002', 'fail', 'Le pronostic du siècle',
   'Goal Average a pronostiqué Allemagne 4-0 Espagne. Le match s''est terminé 0-0.',
   '11111111-0000-0000-0000-000000000003', 41),
  ('44444444-0000-0000-0000-000000000003', 'roast', 'Le coach IA a parlé',
   'Le coach des VARcassés : "Ils gagnent trop. C''est suspect. Je les surveille."',
   '11111111-0000-0000-0000-000000000001', 17),
  ('44444444-0000-0000-0000-000000000004', 'babyfoot', 'Babyfoot : la finale qui a tout déchiré',
   'VARcassés vs FC Réunion Inutile : 5-3 après prolongations fictives.',
   null, 31),
  ('44444444-0000-0000-0000-000000000005', 'phrase', 'Philosophie de tournoi',
   '"Participer c''est gagner." — FC Réunion Inutile (ils participent beaucoup)',
   '11111111-0000-0000-0000-000000000002', 55);

-- 9. Seed — Babyfoot
insert into public.babyfoot_matches (id, team_a_id, team_b_id, starts_at, score_a, score_b, status, highlight) values
  ('55555555-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002',
   '2026-06-12 12:00:00+00', 5, 3, 'finished', 'Les VARcassés ont contesté 3 buts. Tous valides.'),
  ('55555555-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003',
   '2026-06-13 12:00:00+00', 2, 4, 'finished', 'Goal Average a vécu à la hauteur de son nom.'),
  ('55555555-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003',
   '2026-06-16 12:00:00+00', null, null, 'upcoming', null);

-- 10. Seed — Quiz
insert into public.quiz_questions (id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category) values
  ('66666666-0000-0000-0000-000000000001',
   'En quelle année Canal+ a-t-il diffusé son premier match de football ?',
   '1980', '1984', '1987', '1992', 'B', 'easy', 'canal'),
  ('66666666-0000-0000-0000-000000000002',
   'Combien de pays accueillent la Coupe du Monde 2026 ?',
   '1', '2', '3', '4', 'C', 'easy', 'foot'),
  ('66666666-0000-0000-0000-000000000003',
   'Quel pays a remporté le plus de Coupes du Monde ?',
   'Allemagne', 'France', 'Brésil', 'Argentine', 'C', 'medium', 'foot'),
  ('66666666-0000-0000-0000-000000000004',
   'Que signifie VAR dans le football ?',
   'Video Assistant Referee', 'Very Aggressive Referee', 'Virtual Analysis Review', 'Video Action Replay',
   'A', 'easy', 'foot'),
  ('66666666-0000-0000-0000-000000000005',
   'Quelle est la durée réglementaire d''un match de football ?',
   '80 minutes', '90 minutes', '100 minutes', '120 minutes', 'B', 'easy', 'general');
