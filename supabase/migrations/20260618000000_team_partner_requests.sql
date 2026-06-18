-- team_partner_requests — parcours "Demander en binôme" (lancement Canal Cup).
--
-- Un utilisateur SANS équipe propose directement à une autre personne de
-- former une équipe. À l'acceptation, on crée l'équipe et on y met les deux.
-- C'est le parcours PRINCIPAL de constitution des binômes ; le code
-- d'invitation (teams.invite_code) reste un fallback pour les créations
-- manuelles.
--
-- Idempotente (CREATE TABLE / INDEX IF NOT EXISTS).

begin;

create table if not exists public.team_partner_requests (
  id                uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.users(id) on delete cascade,
  target_user_id    uuid not null references public.users(id) on delete cascade,
  proposed_team_name text,
  -- pending  : en attente de réponse du destinataire
  -- accepted : équipe créée, les deux membres dedans (created_team_id rempli)
  -- rejected : refusée par le destinataire
  -- cancelled: annulée par le demandeur
  -- expired  : un des deux a rejoint une équipe entre-temps
  status            text not null default 'pending'
                      check (status in ('pending','accepted','rejected','cancelled','expired')),
  created_team_id   uuid references public.teams(id) on delete set null,
  decided_at        timestamptz,
  created_at        timestamptz not null default now(),
  -- on ne se propose pas à soi-même
  constraint tpr_not_self check (requester_user_id <> target_user_id)
);

create index if not exists idx_tpr_requester on public.team_partner_requests(requester_user_id);
create index if not exists idx_tpr_target    on public.team_partner_requests(target_user_id);

-- Règle produit : un demandeur ne peut avoir qu'UNE demande active à la fois.
create unique index if not exists uniq_tpr_one_pending_per_requester
  on public.team_partner_requests(requester_user_id) where status = 'pending';

-- Éviter les doublons exacts demandeur → destinataire tant que pending.
create unique index if not exists uniq_tpr_pending_pair
  on public.team_partner_requests(requester_user_id, target_user_id) where status = 'pending';

-- RLS : la table n'est manipulée que via les endpoints API (client admin /
-- service_role, qui bypass RLS). On l'active sans policy ouverte pour rester
-- aligné avec l'advisor Supabase (aucun accès direct via la clé anon).
alter table public.team_partner_requests enable row level security;

commit;
