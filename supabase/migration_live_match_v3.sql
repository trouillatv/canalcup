-- ============================================================================
--  migration_live_match_v3.sql  —  Données match avancées (live)
--  À exécuter dans le SQL editor Supabase APRÈS init.sql / schema.sql.
--  Idempotent : ré-exécutable sans casse (if not exists / drop-recreate policy).
--
--  Aligne le schéma sur ce que services/football/sync.ts écrit RÉELLEMENT
--  (team_side 'home'/'away', detail) + colonnes du spec (source, *_id,
--  timestamps). Aucune table existante n'est supprimée.
--
--  Lecture : authenticated (RLS). Écriture : service role uniquement
--  (createAdminClient bypass RLS) — aucune policy insert/update volontairement.
-- ============================================================================

-- ── 1. matches : colonnes attendues par le code provider ────────────────────
alter table public.matches add column if not exists external_id  bigint;
alter table public.matches add column if not exists apif_id      bigint;
alter table public.matches add column if not exists phase        text;
alter table public.matches add column if not exists stage        text;
alter table public.matches add column if not exists minute       int;
alter table public.matches add column if not exists venue        text;
alter table public.matches add column if not exists referee      text;
alter table public.matches add column if not exists is_featured  boolean not null default false;
alter table public.matches add column if not exists updated_at    timestamptz not null default now();

-- status : autoriser halftime / postponed (le code les produit)
alter table public.matches drop constraint if exists matches_status_check;
alter table public.matches add  constraint matches_status_check
  check (status in ('upcoming', 'live', 'halftime', 'finished', 'postponed'));

create unique index if not exists matches_external_id_uidx
  on public.matches (external_id) where external_id is not null;
create unique index if not exists matches_apif_id_uidx
  on public.matches (apif_id) where apif_id is not null;

-- ── 2. match_events ─────────────────────────────────────────────────────────
create table if not exists public.match_events (
  id                  uuid primary key default uuid_generate_v4(),
  match_id            uuid not null references public.matches(id) on delete cascade,
  minute              int not null default 0,
  extra_minute        int,
  type                text not null,            -- goal|yellow_card|red_card|substitution|var|penalty|penalty_missed
  team_side           text not null check (team_side in ('home', 'away')),
  player_name         text not null default '',
  player_id           text,                     -- réservé providers riches
  assist_player_name  text,
  detail              text,
  source              text not null default 'thesportsdb',
  created_at          timestamptz not null default now()
);
create index if not exists match_events_match_idx on public.match_events (match_id, minute);

-- ── 3. match_lineups ────────────────────────────────────────────────────────
create table if not exists public.match_lineups (
  id                  uuid primary key default uuid_generate_v4(),
  match_id            uuid not null references public.matches(id) on delete cascade,
  team_side           text not null check (team_side in ('home', 'away')),
  player_name         text not null default '',
  player_id           text,
  shirt_number        int not null default 0,
  position            text,
  formation_position  text,
  is_starting         boolean not null default true,
  is_substitute       boolean generated always as (not is_starting) stored,
  role                text,
  source              text not null default 'thesportsdb',
  created_at          timestamptz not null default now()
);
create index if not exists match_lineups_match_idx on public.match_lineups (match_id, team_side);

-- ── 4. match_stats ──────────────────────────────────────────────────────────
create table if not exists public.match_stats (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  stat_type   text not null,
  home_value  text not null default '0',
  away_value  text not null default '0',
  source      text not null default 'thesportsdb',
  updated_at  timestamptz not null default now()
);
create unique index if not exists match_stats_uidx
  on public.match_stats (match_id, stat_type);

-- ── 5. player_match_stats  (nouveau — notes & stats joueur) ─────────────────
create table if not exists public.player_match_stats (
  id            uuid primary key default uuid_generate_v4(),
  match_id      uuid not null references public.matches(id) on delete cascade,
  team_side     text not null check (team_side in ('home', 'away')),
  player_name   text not null,
  player_id     text,
  rating        numeric(3,1),                   -- 0.0–10.0 ; null si non dispo
  goals         int not null default 0,
  assists       int not null default 0,
  yellow_cards  int not null default 0,
  red_cards     int not null default 0,
  shots         int not null default 0,
  passes        int not null default 0,
  tackles       int not null default 0,
  dribbles      int not null default 0,
  is_motm       boolean not null default false, -- joueur du match
  source        text not null default 'api-football', -- api-football | gemini
  updated_at    timestamptz not null default now()
);
create unique index if not exists player_match_stats_uidx
  on public.player_match_stats (match_id, team_side, player_name);

-- ── 6. standings ────────────────────────────────────────────────────────────
create table if not exists public.standings (
  id              uuid primary key default uuid_generate_v4(),
  competition     text not null default 'FIFA World Cup 2026',
  group_name      text not null,
  team_name       text not null,
  team_name_fr    text,
  team_flag       text,
  rank            int not null default 0,
  played          int not null default 0,
  won             int not null default 0,
  draw            int not null default 0,
  lost            int not null default 0,
  goals_for       int not null default 0,
  goals_against   int not null default 0,
  goal_diff       int not null default 0,
  points          int not null default 0,
  updated_at      timestamptz not null default now(),
  unique (competition, group_name, team_name)
);

-- ── 7. RLS : lecture authenticated, écriture service role uniquement ────────
alter table public.match_events       enable row level security;
alter table public.match_lineups      enable row level security;
alter table public.match_stats        enable row level security;
alter table public.player_match_stats enable row level security;
alter table public.standings          enable row level security;

drop policy if exists "Lecture match_events"       on public.match_events;
drop policy if exists "Lecture match_lineups"      on public.match_lineups;
drop policy if exists "Lecture match_stats"        on public.match_stats;
drop policy if exists "Lecture player_match_stats" on public.player_match_stats;
drop policy if exists "Lecture standings"          on public.standings;

create policy "Lecture match_events"       on public.match_events       for select to authenticated using (true);
create policy "Lecture match_lineups"      on public.match_lineups      for select to authenticated using (true);
create policy "Lecture match_stats"        on public.match_stats        for select to authenticated using (true);
create policy "Lecture player_match_stats" on public.player_match_stats for select to authenticated using (true);
create policy "Lecture standings"          on public.standings          for select to authenticated using (true);

-- ============================================================================
--  Fin migration_live_match_v3.sql
-- ============================================================================
