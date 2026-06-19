-- ============================================================================
--  migration_jokers_v1.sql — Module Jokers Canal Cup (MVP)
--  À exécuter via : node scripts/migrate.js --file supabase/migration_jokers_v1.sql
--  Idempotent : ré-exécutable (if not exists / drop-recreate policy).
--
--  Les jokers sont PERSONNELS (comme les pronos). Leurs effets de points
--  touchent le classement INDIVIDUEL, jamais le score d'équipe. Lecture :
--  authenticated (les jokers offensifs sont publics). Écriture : service role
--  uniquement (createAdminClient bypass RLS) — aucune policy insert/update.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ── 1. joker_wallets : possession des jokers par joueur ─────────────────────
create table if not exists public.joker_wallets (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.users(id) on delete cascade,
  joker_type  text not null
    check (joker_type in ('casino','quitte_ou_double','carton_rouge','brouillard','espion','var','retard_avion')),
  quantity    int  not null default 0 check (quantity >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, joker_type)
);
create index if not exists idx_joker_wallets_user on public.joker_wallets(user_id);

-- ── 2. joker_plays : un joker joué (consommé) ──────────────────────────────
create table if not exists public.joker_plays (
  id                 uuid primary key default uuid_generate_v4(),
  joker_type         text not null
    check (joker_type in ('casino','quitte_ou_double','carton_rouge','brouillard','espion','var','retard_avion')),
  played_by_user_id  uuid not null references public.users(id) on delete cascade,
  target_user_id     uuid references public.users(id) on delete set null,
  match_id           uuid references public.matches(id) on delete set null,
  status             text not null default 'active'
    check (status in ('active','consumed','expired','cancelled')),
  effect_starts_at   timestamptz,
  effect_ends_at     timestamptz,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);
create index if not exists idx_joker_plays_player  on public.joker_plays(played_by_user_id);
create index if not exists idx_joker_plays_target  on public.joker_plays(target_user_id);
create index if not exists idx_joker_plays_match   on public.joker_plays(match_id);
create index if not exists idx_joker_plays_status  on public.joker_plays(status);
create index if not exists idx_joker_plays_created on public.joker_plays(created_at desc);

-- ── 3. joker_effects : effets actifs résultant d'un joker joué ──────────────
--  effect_type : red_card_block | fog | flight_delay | var_window | spy
create table if not exists public.joker_effects (
  id                uuid primary key default uuid_generate_v4(),
  joker_play_id     uuid not null references public.joker_plays(id) on delete cascade,
  affected_user_id  uuid not null references public.users(id) on delete cascade,
  match_id          uuid references public.matches(id) on delete set null,
  effect_type       text not null
    check (effect_type in ('red_card_block','fog','flight_delay','var_window','spy')),
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  status            text not null default 'active'
    check (status in ('active','consumed','expired','cancelled')),
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists idx_joker_effects_user   on public.joker_effects(affected_user_id, status);
create index if not exists idx_joker_effects_match   on public.joker_effects(match_id);
create index if not exists idx_joker_effects_type    on public.joker_effects(effect_type, status);
create index if not exists idx_joker_effects_play    on public.joker_effects(joker_play_id);

-- ── 4. RLS — lecture authenticated, écriture service role uniquement ────────
alter table public.joker_wallets enable row level security;
alter table public.joker_plays   enable row level security;
alter table public.joker_effects enable row level security;

drop policy if exists "Lecture joker_wallets" on public.joker_wallets;
drop policy if exists "Lecture joker_plays"   on public.joker_plays;
drop policy if exists "Lecture joker_effects" on public.joker_effects;

create policy "Lecture joker_wallets" on public.joker_wallets for select to authenticated using (true);
create policy "Lecture joker_plays"   on public.joker_plays   for select to authenticated using (true);
create policy "Lecture joker_effects" on public.joker_effects for select to authenticated using (true);

-- ── 5. Live feed : autorise le type 'joker' (Canal Cup Live / TV Chaos) ─────
alter table public.feed_posts drop constraint if exists feed_posts_type_check;
alter table public.feed_posts add constraint feed_posts_type_check
  check (type in ('ambiance','photo','chambrage','match','babyfoot','quiz','animation','robert','joker'));
