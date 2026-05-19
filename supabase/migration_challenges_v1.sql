-- ============================================================================
--  migration_challenges_v1.sql  —  Activités animées Canal Cup + scoring générique
--  À exécuter dans le SQL editor Supabase APRÈS init.sql / schema.sql, ou via
--  node scripts/migrate.js --file supabase/migration_challenges_v1.sql
--  Idempotent : ré-exécutable sans casse (if not exists / drop-recreate policy /
--  seed on conflict do nothing). Aucune table existante n'est modifiée.
--
--  Backbone scoring : score_events est LA source générique. Toute activité
--  écrit une ligne ici (jamais d'écriture directe dans teams.total_points).
--  Le leaderboard sommera score_events en plus des sources actuelles dans une
--  étape ultérieure (cf. lib/data/teams.ts) — non câblé ici volontairement.
--
--  Lecture : authenticated (RLS). Écriture : service role uniquement
--  (createAdminClient bypass RLS) — aucune policy insert/update volontairement.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── 1. challenges : les activités animées ───────────────────────────────────
create table if not exists public.challenges (
  id               uuid primary key default uuid_generate_v4(),
  slug             text not null unique,
  title            text not null,
  emoji            text not null default '🎯',
  description      text not null,
  rules            text,                                  -- déroulé / règles
  location         text,
  duration_minutes int,
  max_points       int  not null default 30,
  category         text not null default 'challenges'
    check (category in ('challenges', 'social')),
  phase            int  not null default 1,               -- 1 = MVP, 2 = plus tard
  status           text not null default 'upcoming'
    check (status in ('upcoming', 'live', 'finished', 'hidden')),
  sort_order       int  not null default 0,
  created_at       timestamptz not null default now()
);

-- ── 2. challenge_entries : participations d'équipe ──────────────────────────
create table if not exists public.challenge_entries (
  id             uuid primary key default uuid_generate_v4(),
  challenge_id   uuid not null references public.challenges(id) on delete cascade,
  team_id        uuid not null references public.teams(id),
  user_id        uuid references public.users(id),
  title          text,
  content        text,
  image_url      text,
  points_awarded int  not null default 0,
  status         text not null default 'pending'
    check (status in ('pending', 'approved', 'hidden')),
  created_at     timestamptz not null default now()
);
create index if not exists idx_challenge_entries_challenge on public.challenge_entries(challenge_id);
create index if not exists idx_challenge_entries_team      on public.challenge_entries(team_id);

-- ── 3. score_events : source de scoring générique (backbone) ────────────────
--  category    : famille de points (predictions|quiz|challenges|babyfoot|social|bonus)
--  source_type : nature de l'événement source
--  source_id   : id de la ligne source (challenge_entry.id, vote.id, ...) — nullable
--  raw_points  : points bruts attribués (pondération par catégorie = étape future)
create table if not exists public.score_events (
  id          uuid primary key default uuid_generate_v4(),
  team_id     uuid not null references public.teams(id),
  user_id     uuid references public.users(id),
  category    text not null
    check (category in ('predictions', 'quiz', 'challenges', 'babyfoot', 'social', 'bonus')),
  source_type text not null
    check (source_type in ('challenge_entry', 'manual_admin', 'quiz_answer', 'babyfoot_match', 'prediction', 'vote', 'award')),
  source_id   uuid,
  raw_points  int  not null default 0,
  label       text not null,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_score_events_team   on public.score_events(team_id);
create index if not exists idx_score_events_source on public.score_events(source_type, source_id);

-- ── 4. RLS — lecture authenticated, écriture service role uniquement ────────
alter table public.challenges        enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.score_events      enable row level security;

drop policy if exists "Lecture challenges"        on public.challenges;
drop policy if exists "Lecture challenge_entries" on public.challenge_entries;
drop policy if exists "Lecture score_events"      on public.score_events;

create policy "Lecture challenges"        on public.challenges        for select to authenticated using (true);
create policy "Lecture challenge_entries" on public.challenge_entries for select to authenticated using (true);
create policy "Lecture score_events"      on public.score_events      for select to authenticated using (true);

-- ── 5. Seed des activités (idempotent : on conflict slug do nothing) ────────
insert into public.challenges
  (slug, title, emoji, description, rules, location, duration_minutes, max_points, category, phase, status, sort_order)
values
  ('qui-est-ce-joueur',
   'Qui est ce joueur ?', '🕵️',
   'Reconnaissez le joueur de Coupe du Monde à partir d''indices de plus en plus évidents. La culture foot du bureau au grand jour.',
   'L''animateur projette une silhouette puis des indices (club, sélection, poste). Chaque équipe écrit sa réponse. Bonne réponse aux premiers indices = plus de points. L''animateur attribue les points via l''admin.',
   'Salle de projection', 20, 40, 'challenges', 1, 'upcoming', 10),

  ('reconnaitre-hymne',
   'Reconnaître l''hymne', '🎵',
   'Un extrait d''hymne national, une nation à deviner. Les supporters s''enflamment, les experts doutent.',
   'L''animateur diffuse un extrait d''hymne. La première équipe à lever la main et répondre juste marque. L''animateur valide et attribue les points via l''admin.',
   'Salle de projection', 15, 30, 'challenges', 1, 'upcoming', 20),

  ('le-commentateur',
   'Le Commentateur Canal+', '🎙️',
   'Commentez une action de légende façon Canal+. 30 secondes pour faire vibrer la salle (et le jury).',
   'Chaque équipe désigne un commentateur. Action muette projetée, commentaire en direct. Le jury (animateur) note la prestation et attribue les points via l''admin.',
   'Scène principale', 25, 50, 'challenges', 1, 'upcoming', 30),

  ('concours-jongle',
   'Concours de jongle', '⚽',
   'Le défi le plus simple du monde. En théorie. Un ballon, vos pieds, la pression de tout l''open space.',
   'Un représentant par équipe. Nombre de jongles enchaînées sans faute. L''animateur compte et attribue les points via l''admin.',
   'Hall / extérieur', 20, 40, 'challenges', 1, 'upcoming', 40),

  ('le-bureau-parle',
   'Le Bureau Parle', '🗣️',
   'Le grand quiz oral collaboratif : foot, Canal+, culture G. Toute l''équipe répond, dans la bonne humeur.',
   'Questions posées à l''oral à chaque équipe à tour de rôle. Réponse juste = points. L''animateur arbitre et attribue les points via l''admin.',
   'Salle de réunion', 30, 60, 'challenges', 1, 'upcoming', 50),

  ('photo-supporters',
   'Photo des supporters', '📸',
   'La plus belle photo d''équipe supporter du tournoi. Créativité, ambiance, esprit Canal Cup.',
   'Phase 2 — Chaque équipe soumet une photo. Vote des autres équipes + coup de cœur du jury. (Upload & vote ouverts ultérieurement.)',
   'Partout', null, 30, 'social', 2, 'upcoming', 60),

  ('musee-canal-cup',
   'Musée Canal Cup', '🏛️',
   'L''archive vivante du tournoi : meilleurs moments, fails légendaires, citations cultes. 0 point, 100% de plaisir.',
   'Phase 2 — Galerie consultable, sans scoring. La mémoire collective de la Canal Cup.',
   'En ligne', null, 0, 'social', 2, 'upcoming', 70)
on conflict (slug) do nothing;
