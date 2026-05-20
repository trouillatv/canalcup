-- migration_team_memberships_v1
-- Multi-équipes (Phase A) : un user peut appartenir à N équipes.
-- 1 équipe est marquée `is_primary=true` → c'est celle qui reçoit ses
-- pronos/quiz/bonus (évite le double comptage au classement équipe).
-- `users.team_id` est CONSERVÉ comme miroir de l'équipe principale
-- (synchronisé par l'app en Phase B) → toute la couche scoring/leaderboard
-- existante continue à fonctionner SANS refonte.
--
-- Relâche la contrainte users_profile_complete_chk : un user peut désormais
-- finir l'onboarding SANS équipe (il pourra créer/rejoindre plus tard).
-- Conséquence : les pronos sont bloqués tant qu'il n'a pas d'équipe
-- principale (vérification API existante).
--
-- Backfill : pour chaque user avec users.team_id → 1 membership primary
-- avec son team_role actuel. Vincent (captain de Les Cassos) reste captain
-- de Les Cassos, is_primary=true. Aucune perte de données.
--
-- Idempotente.

begin;

-- 1. Table de jointure.
create table if not exists public.team_memberships (
  user_id    uuid not null references public.users(id) on delete cascade,
  team_id    uuid not null references public.teams(id) on delete cascade,
  role       text not null default 'member' check (role in ('member','captain')),
  is_primary boolean not null default false,
  joined_at  timestamptz not null default now(),
  primary key (user_id, team_id)
);

create index if not exists idx_tm_user on public.team_memberships(user_id);
create index if not exists idx_tm_team on public.team_memberships(team_id);

-- 1 SEULE équipe principale par user (partial unique index).
create unique index if not exists uniq_tm_one_primary_per_user
  on public.team_memberships(user_id) where is_primary = true;

-- 2. Backfill depuis users.team_id (1 membership primary par user actuellement
--    affecté). Idempotent via PK (user_id, team_id) + ON CONFLICT DO NOTHING.
insert into public.team_memberships (user_id, team_id, role, is_primary, joined_at)
select u.id,
       u.team_id,
       coalesce(nullif(u.team_role, ''), 'member'),
       true,
       coalesce(u.last_login_at, now())
from public.users u
where u.team_id is not null
on conflict do nothing;

-- 3. Relâche la contrainte profil — team_id devient OPTIONNEL.
alter table public.users drop constraint if exists users_profile_complete_chk;
alter table public.users add constraint users_profile_complete_chk check (
  profile_completed = false
  or (
    service_id is not null
    and football_level is not null
    and coalesce(nullif(btrim(display_name), ''), nullif(btrim(name), '')) is not null
  )
);

commit;
