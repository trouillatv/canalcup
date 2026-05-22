-- Table feedback : retours/bugs envoyés par les utilisateurs (testeurs) via la
-- bulle de feedback in-app. Consultés depuis l'admin (/admin/feedback).
-- Idempotent.
--
-- Accès : aucune policy RLS → la table n'est lisible/écrivable QUE via le
-- service_role (routes API serveur). Le client n'y touche jamais directement.

create table if not exists public.feedback (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references public.users(id) on delete set null,
  email       text,
  display_name text,
  message     text not null,
  page        text,                       -- chemin où le feedback a été émis
  status      text not null default 'new', -- new | read | resolved
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx on public.feedback (status);

alter table public.feedback enable row level security;
-- Pas de policy : accès réservé au service_role (API admin/serveur).
