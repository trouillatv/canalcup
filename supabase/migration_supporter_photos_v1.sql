-- ============================================================================
--  migration_supporter_photos_v1.sql — Journée Supporters Canal Cup
--  À exécuter via : node scripts/migrate.js --file supabase/migration_supporter_photos_v1.sql
--  Idempotent : ré-exécutable (if not exists / drop-recreate policy).
--
--  Animation dédiée : chaque binôme (= team) poste UNE photo de supporters,
--  validée par un admin (+10 pts de participation à la validation), puis votée
--  individuellement par tous les inscrits. À la clôture : podium +40/+30/+20.
--
--  Points = PERSONNELS/animation → score_events catégorie 'social' (pilier
--  Animations, pondéré 25 %), une ligne par membre du binôme. JAMAIS
--  teams.total_points. Lecture : authenticated. Écriture : service role
--  uniquement (createAdminClient bypass RLS) — aucune policy insert/update.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── 1. supporter_photo_entries : une photo par binôme (team) ────────────────
create table if not exists public.supporter_photo_entries (
  id                    uuid primary key default uuid_generate_v4(),
  team_id               uuid not null references public.teams(id) on delete cascade,
  uploaded_by_user_id   uuid references public.users(id) on delete set null,
  title                 text,
  photo_url             text not null,
  status                text not null default 'submitted'
    check (status in ('draft','submitted','approved','hidden')),
  -- Garde-fous d'attribution (anti double-comptage des score_events).
  participation_awarded boolean not null default false,
  podium_rank           int check (podium_rank between 1 and 3),
  created_at            timestamptz not null default now(),
  approved_at           timestamptz,
  -- Une seule photo par binôme : un re-post écrase l'existante (upsert).
  unique (team_id)
);
create index if not exists idx_supporter_entries_status on public.supporter_photo_entries(status);
create index if not exists idx_supporter_entries_team   on public.supporter_photo_entries(team_id);

-- ── 2. supporter_photo_votes : un vote individuel, une fois, pas pour soi ────
create table if not exists public.supporter_photo_votes (
  id              uuid primary key default uuid_generate_v4(),
  entry_id        uuid not null references public.supporter_photo_entries(id) on delete cascade,
  voter_user_id   uuid not null references public.users(id) on delete cascade,
  voter_team_id   uuid references public.teams(id) on delete set null,
  created_at      timestamptz not null default now(),
  -- 1 vote par utilisateur sur toute l'animation.
  unique (voter_user_id)
);
create index if not exists idx_supporter_votes_entry on public.supporter_photo_votes(entry_id);

-- ── 3. supporter_settings : état du concours (ligne unique id=1) ─────────────
create table if not exists public.supporter_settings (
  id                 int primary key default 1 check (id = 1),
  votes_open         boolean not null default false,
  results_published  boolean not null default false,
  updated_at         timestamptz not null default now()
);
insert into public.supporter_settings (id, votes_open, results_published)
  values (1, false, false)
  on conflict (id) do nothing;

-- ── 4. RLS — lecture authenticated, écriture service role uniquement ────────
alter table public.supporter_photo_entries enable row level security;
alter table public.supporter_photo_votes   enable row level security;
alter table public.supporter_settings       enable row level security;

drop policy if exists "Lecture supporter_entries"  on public.supporter_photo_entries;
drop policy if exists "Lecture supporter_votes"    on public.supporter_photo_votes;
drop policy if exists "Lecture supporter_settings" on public.supporter_settings;

create policy "Lecture supporter_entries"  on public.supporter_photo_entries  for select to authenticated using (true);
create policy "Lecture supporter_votes"    on public.supporter_photo_votes    for select to authenticated using (true);
create policy "Lecture supporter_settings" on public.supporter_settings       for select to authenticated using (true);

-- ── 5. Storage : bucket public pour les photos supporters ───────────────────
insert into storage.buckets (id, name, public)
  values ('supporter-photos', 'supporter-photos', true)
  on conflict (id) do nothing;
