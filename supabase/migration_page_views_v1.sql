-- ============================================================================
--  migration_page_views_v1.sql
--  Suivi d'usage : une ligne par navigation de page (utilisateur connecté).
--  Alimente l'analytics admin (pages utilisées/inutilisées, fréquence, joueurs
--  actifs). Écrit par /api/track (service_role), lu par l'admin (service_role).
--  RLS activé sans policy → invisible aux clients session (privé).
--  Idempotent.
-- ============================================================================

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  user_id uuid references public.users(id) on delete set null,
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_path_idx    on public.page_views (path);
create index if not exists page_views_user_idx     on public.page_views (user_id);
create index if not exists page_views_created_idx  on public.page_views (created_at desc);

alter table public.page_views enable row level security;
-- Aucune policy : accès uniquement via service_role (API /api/track + admin).
