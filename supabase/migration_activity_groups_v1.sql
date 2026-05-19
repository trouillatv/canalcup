-- migration_activity_groups_v1
-- Phase 2.A : groupes par activité.
-- Un défi peut être solo ou en groupe (allows_group). Une participation
-- peut avoir N participants (challenge_entry_participants). Le total
-- attribué à l'entry est divisé en parts entières égales entre eux dans
-- score_events ; chaque participant crédite SON équipe Canal Cup
-- (gestion naturelle des groupes inter-équipes).
--
-- Backfill : entries existantes avec user_id → 1 participant (solo). Les
-- entries "team-level" (user_id NULL, créées par l'admin sans
-- assignation perso) restent sans participants → syncScoreEvent
-- conservera le comportement actuel (1 ligne au team_id de l'entry).
-- Aucune perte de scoring existant.

-- 1. Flag de défi (par défaut : solo).
alter table public.challenges
  add column if not exists allows_group boolean not null default false;

-- 2. Table de participants. PK composite, FK avec CASCADE.
create table if not exists public.challenge_entry_participants (
  entry_id   uuid not null references public.challenge_entries(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id)
);

-- Index pour les requêtes côté user (mes groupes par activité — phase 2.C).
create index if not exists idx_cep_user
  on public.challenge_entry_participants(user_id);

-- 3. Backfill (idempotent via PK + ON CONFLICT DO NOTHING).
insert into public.challenge_entry_participants (entry_id, user_id)
select id, user_id
from public.challenge_entries
where user_id is not null
on conflict do nothing;
