-- ============================================================================
--  migration_canalcup_moments_v1.sql — Mur « Moments CanalCup »
--  À exécuter via : node scripts/migrate.js --file supabase/migration_canalcup_moments_v1.sql
--
--  Module INDÉPENDANT du concours Supporters (cf. distinction produit) :
--  mémoire collective de l'événement. N'IMPORTE QUEL joueur publie une photo
--  (binôme ou non), avec une catégorie. AUCUN vote, AUCUN classement, AUCUN
--  gagnant. Réactions + commentaires uniquement (social). Permanent.
--  Tables/bucket DÉDIÉS : ne JAMAIS brancher sur supporter_photo_*.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── 1. canalcup_moments : une photo libre de l'événement ────────────────────
create table if not exists public.canalcup_moments (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid references public.users(id) on delete set null,
  author_name  text not null,
  title        text,
  category     text not null default 'fun'
    check (category in ('match','supporters','animation','equipe','fun','salon')),
  photo_url    text not null,
  media_type   text not null default 'image' check (media_type in ('image','video')),
  status       text not null default 'visible' check (status in ('visible','hidden')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_moments_created  on public.canalcup_moments(created_at desc);
create index if not exists idx_moments_category on public.canalcup_moments(category);

-- ── 2. réactions emoji (toggle, multi par user) ─────────────────────────────
create table if not exists public.canalcup_moment_reactions (
  id          uuid primary key default uuid_generate_v4(),
  moment_id   uuid not null references public.canalcup_moments(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (moment_id, user_id, emoji)
);
create index if not exists idx_moment_reactions_moment on public.canalcup_moment_reactions(moment_id);

-- ── 3. commentaires ─────────────────────────────────────────────────────────
create table if not exists public.canalcup_moment_comments (
  id           uuid primary key default uuid_generate_v4(),
  moment_id    uuid not null references public.canalcup_moments(id) on delete cascade,
  user_id      uuid references public.users(id) on delete set null,
  display_name text not null,
  body         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists idx_moment_comments_moment on public.canalcup_moment_comments(moment_id);

-- ── 4. RLS — lecture authenticated, écriture service role uniquement ────────
alter table public.canalcup_moments          enable row level security;
alter table public.canalcup_moment_reactions enable row level security;
alter table public.canalcup_moment_comments  enable row level security;

drop policy if exists "Lecture moments"          on public.canalcup_moments;
drop policy if exists "Lecture moment_reactions" on public.canalcup_moment_reactions;
drop policy if exists "Lecture moment_comments"  on public.canalcup_moment_comments;

create policy "Lecture moments"          on public.canalcup_moments          for select to authenticated using (true);
create policy "Lecture moment_reactions" on public.canalcup_moment_reactions for select to authenticated using (true);
create policy "Lecture moment_comments"  on public.canalcup_moment_comments  for select to authenticated using (true);

-- ── 5. Storage : bucket public dédié aux Moments ────────────────────────────
insert into storage.buckets (id, name, public)
  values ('canalcup-moments', 'canalcup-moments', true)
  on conflict (id) do nothing;
