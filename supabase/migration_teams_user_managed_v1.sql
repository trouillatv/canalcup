-- migration_teams_user_managed_v1
-- Refonte douce du modèle d'équipes :
-- - les users CRÉENT leur équipe (au lieu de piocher dans une liste seed)
-- - rejoindre une équipe = code d'invitation (lien partageable)
-- - le créateur (= captain) approuve ou rejette les demandes
-- - cap 3 membres / équipe
--
-- NON DESTRUCTIVE : on garde les 3 équipes seed existantes (Vincent reste
-- dans VARcassés). Elles ne seront simplement plus listées dans l'onboarding
-- (refonte UI dans le commit B) ; on leur laisse invite_code NULL → elles
-- ne sont pas joignables via le nouveau flow, mais elles restent valides
-- pour l'historique et les tests.
--
-- Idempotente (ADD COLUMN IF NOT EXISTS, CREATE TABLE IF NOT EXISTS, etc.).

begin;

-- 1. Créateur d'équipe (NULLABLE pour ne pas casser les seed historiques).
--    ON DELETE SET NULL : si on supprime un user créateur plus tard,
--    l'équipe survit (orpheline, à reprendre via admin).
alter table public.teams
  add column if not exists created_by_user_id uuid references public.users(id) on delete set null;

-- 2. Code d'invitation unique (NULL pour les seed = pas de lien partageable
--    pour celles-ci ; les futures équipes en auront un, généré côté app).
alter table public.teams
  add column if not exists invite_code text;

-- Unique partiel : la contrainte ne s'applique qu'aux invite_code non NULL.
create unique index if not exists uniq_teams_invite_code
  on public.teams(invite_code) where invite_code is not null;

-- 3. Demandes d'adhésion.
create table if not exists public.team_join_requests (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending','approved','rejected')) default 'pending',
  decided_by_user_id uuid references public.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_tjr_team on public.team_join_requests(team_id);
create index if not exists idx_tjr_user on public.team_join_requests(user_id);

-- 1 SEUL pending par user à la fois (peut re-demander après rejet/approbation).
create unique index if not exists uniq_tjr_one_pending_per_user
  on public.team_join_requests(user_id) where status = 'pending';

commit;
