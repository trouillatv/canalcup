-- Lot 1 (P2) — socle référentiel multi-sport.
-- Sport -> Competition -> Season -> Event -> EventParticipant, + Participant.
-- Voir docs/adr/0001-multi-sport-data-model.md (dont Addendum P2).
-- Aucun système de pronostic/scoring dans ce lot (MarketType/Prediction/
-- ScoringRule explicitement hors scope) et aucune table event_broadcasts
-- (hors scope de ce lot également).

-- 1) Fonction générique de mise à jour de updated_at, réutilisée par les
--    triggers ci-dessous (une seule fonction, pas une par table).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2) Sport
create table if not exists public.sports (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_sports_updated_at on public.sports;
create trigger trg_sports_updated_at
before update on public.sports
for each row execute function public.set_updated_at();

-- 3) Competition
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  slug text not null,
  name text not null,
  format text,
  source text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint competitions_sport_slug_key unique (sport_id, slug),
  constraint competitions_source_external_id_key unique (source, external_id)
);

create index if not exists competitions_sport_id_idx on public.competitions(sport_id);

drop trigger if exists trg_competitions_updated_at on public.competitions;
create trigger trg_competitions_updated_at
before update on public.competitions
for each row execute function public.set_updated_at();

-- 4) Season
create table if not exists public.seasons (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete restrict,
  label text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  source text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_competition_label_key unique (competition_id, label),
  constraint seasons_source_external_id_key unique (source, external_id)
);

create index if not exists seasons_competition_id_idx on public.seasons(competition_id);

drop trigger if exists trg_seasons_updated_at on public.seasons;
create trigger trg_seasons_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

-- 5) Participant (équipe OU individu — pilote, écurie... selon le sport).
--    Pas de home_team_id/away_team_id sur Event : un Event a 0..N
--    participants via event_participants, valable aussi bien pour un match
--    (2 participants) qu'une course (20+ participants).
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  type text not null check (type in ('team', 'individual')),
  name text not null,
  short_name text,
  country text,
  source text,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participants_source_external_id_key unique (source, external_id)
);

create index if not exists participants_sport_id_idx on public.participants(sport_id);

drop trigger if exists trg_participants_updated_at on public.participants;
create trigger trg_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

-- 6) Event
--    stage/stage_order/matchday/leg + source/external_id : Addendum P2,
--    voir ADR-0001 pour la justification (cas réel Ligue des Champions).
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete restrict,
  starts_at timestamptz not null,
  venue text,
  status text not null default 'scheduled'
    check (status in ('scheduled', 'live', 'finished', 'postponed', 'cancelled')),
  stage text,
  stage_order int,
  matchday int,
  leg int,
  source text,
  external_id text,
  last_synced_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_source_external_id_key unique (source, external_id)
);

create index if not exists events_season_id_idx on public.events(season_id);
create index if not exists events_starts_at_idx on public.events(starts_at);
create index if not exists events_status_idx on public.events(status);

drop trigger if exists trg_events_updated_at on public.events;
create trigger trg_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

-- 7) EventParticipant
create table if not exists public.event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete restrict,
  role text,
  created_at timestamptz not null default now(),
  constraint event_participants_event_participant_key unique (event_id, participant_id)
);

create index if not exists event_participants_event_id_idx on public.event_participants(event_id);
create index if not exists event_participants_participant_id_idx on public.event_participants(participant_id);

-- 8) RLS — lecture pour les utilisateurs authentifiés, écriture réservée au
--    service_role (aucune policy insert/update/delete pour authenticated),
--    même convention que le reste du schéma (voir supabase/schema.sql).
alter table public.sports enable row level security;
alter table public.competitions enable row level security;
alter table public.seasons enable row level security;
alter table public.participants enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;

create policy "Lecture sports" on public.sports for select to authenticated using (true);
create policy "Lecture competitions" on public.competitions for select to authenticated using (true);
create policy "Lecture seasons" on public.seasons for select to authenticated using (true);
create policy "Lecture participants" on public.participants for select to authenticated using (true);
create policy "Lecture events" on public.events for select to authenticated using (true);
create policy "Lecture event_participants" on public.event_participants for select to authenticated using (true);

-- 9) Seed minimal — entités réelles et statiques uniquement (aucun résultat,
--    aucun événement fictif). Compétitions/saisons réelles pour vérifier
--    que le socle couvre foot (Ligue des Champions), F1 et rugby.
insert into public.sports (slug, name, icon) values
  ('football', 'Football', '⚽'),
  ('f1', 'Formule 1', '🏎️'),
  ('rugby', 'Rugby', '🏉')
on conflict (slug) do nothing;

insert into public.competitions (sport_id, slug, name, format)
select s.id, c.slug, c.name, c.format
from (values
  ('football', 'uefa-champions-league', 'UEFA Champions League', 'league_then_knockout'),
  ('f1', 'fia-f1-world-championship', 'FIA Formula 1 World Championship', 'championship'),
  ('rugby', 'top-14', 'Top 14', 'league_then_knockout')
) as c(sport_slug, slug, name, format)
join public.sports s on s.slug = c.sport_slug
on conflict (sport_id, slug) do nothing;

insert into public.seasons (competition_id, label, starts_at, ends_at)
select co.id, se.label, se.starts_at, se.ends_at
from (values
  ('uefa-champions-league', '2025-2026', '2025-09-16T18:45:00Z'::timestamptz, '2026-05-30T20:00:00Z'::timestamptz),
  ('fia-f1-world-championship', '2026', '2026-03-08T00:00:00Z'::timestamptz, '2026-12-06T00:00:00Z'::timestamptz),
  ('top-14', '2025-2026', '2025-08-29T00:00:00Z'::timestamptz, '2026-06-27T00:00:00Z'::timestamptz)
) as se(competition_slug, label, starts_at, ends_at)
join public.competitions co on co.slug = se.competition_slug
on conflict (competition_id, label) do nothing;
