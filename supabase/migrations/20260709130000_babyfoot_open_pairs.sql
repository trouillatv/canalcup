-- ============================================================================
-- Baby-foot V1 : aider les personnes SEULES à trouver un binôme, sans fragiliser
-- le scoring. ADDITIF, moteur inchangé.
--
-- Deux natures d'inscription (babyfoot_entries.kind) :
--   'official' : binôme RSE existant (team_id, 2 joueurs) → points INDIVIDUELS
--                (aux 2) + points ÉQUIPE. Comportement actuel, inchangé.
--   'open'     : paire ad-hoc créée pour le baby-foot (2 joueurs LIBRES) →
--                points INDIVIDUELS seulement (aux 2), JAMAIS de points équipe.
--
-- RÈGLE : une personne n'appartient qu'à UNE seule inscription active par édition
-- (officielle OU ad-hoc). PAS de coéquipier d'appoint en V1.
-- ============================================================================

begin;

-- 1) babyfoot_entries : nature + joueurs explicites (pour les paires ad-hoc).
alter table public.babyfoot_entries
  add column if not exists kind text not null default 'official'
    check (kind in ('official', 'open')),
  add column if not exists p1_user_id uuid references public.users(id) on delete set null,
  add column if not exists p2_user_id uuid references public.users(id) on delete set null;

-- team_id devient NULLABLE (une paire ad-hoc n'a pas d'équipe RSE).
alter table public.babyfoot_entries alter column team_id drop not null;

-- 2) babyfoot_matches : identité des participants = l'ENTRÉE (officiel comme
--    ad-hoc). team_a_id/team_b_id conservés (compat / libellés officiels).
alter table public.babyfoot_matches
  add column if not exists entry_a_id uuid references public.babyfoot_entries(id) on delete set null,
  add column if not exists entry_b_id uuid references public.babyfoot_entries(id) on delete set null;

-- Backfill des matchs existants (test en cours) : entry_id déduit du team_id.
update public.babyfoot_matches m set
  entry_a_id = (select e.id from public.babyfoot_entries e where e.tournament_id = m.tournament_id and e.team_id = m.team_a_id limit 1),
  entry_b_id = (select e.id from public.babyfoot_entries e where e.tournament_id = m.tournament_id and e.team_id = m.team_b_id limit 1)
where entry_a_id is null;

-- 3) Demandes de partenaire.
create table if not exists public.babyfoot_partner_requests (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.babyfoot_tournaments(id) on delete cascade,
  from_user_id uuid not null references public.users(id) on delete cascade,
  to_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
-- Une seule demande EN ATTENTE pour un couple (émetteur → destinataire) par édition.
create unique index if not exists babyfoot_req_pending_uniq
  on public.babyfoot_partner_requests (tournament_id, from_user_id, to_user_id)
  where status = 'pending';
create index if not exists babyfoot_req_to_pending
  on public.babyfoot_partner_requests (to_user_id) where status = 'pending';

-- 4) "Je cherche un partenaire" (liste publique).
create table if not exists public.babyfoot_seeking (
  tournament_id uuid not null references public.babyfoot_tournaments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

-- 5) RLS : lecture aux authentifiés, écritures via service role (routes API).
alter table public.babyfoot_partner_requests enable row level security;
alter table public.babyfoot_seeking enable row level security;
drop policy if exists babyfoot_req_read on public.babyfoot_partner_requests;
create policy babyfoot_req_read on public.babyfoot_partner_requests for select to authenticated using (true);
drop policy if exists babyfoot_seek_read on public.babyfoot_seeking;
create policy babyfoot_seek_read on public.babyfoot_seeking for select to authenticated using (true);

-- 6) Trigger de validation : 'official' (comme avant) ET 'open' (2 joueurs LIBRES).
create or replace function public.babyfoot_entry_validate()
returns trigger
language plpgsql
as $$
declare
  member_count int;
  conflict_count int;
  new_players uuid[];
begin
  if NEW.kind = 'official' then
    select count(*) into member_count from public.team_memberships where team_id = NEW.team_id;
    if member_count <> 2 then
      raise exception 'Un binôme baby-foot officiel doit compter exactement 2 joueurs (cette équipe en a %).', member_count
        using errcode = 'check_violation';
    end if;
    new_players := array(select user_id from public.team_memberships where team_id = NEW.team_id);
  else
    if NEW.p1_user_id is null or NEW.p2_user_id is null or NEW.p1_user_id = NEW.p2_user_id then
      raise exception 'Une paire ad-hoc doit avoir 2 joueurs distincts.' using errcode = 'check_violation';
    end if;
    new_players := array[NEW.p1_user_id, NEW.p2_user_id];
  end if;

  -- Aucun de ces joueurs déjà engagé dans une AUTRE inscription de la même édition
  -- (membre d'un binôme officiel, ou p1/p2 d'une paire ad-hoc). 1 joueur = 1 inscription.
  select count(*) into conflict_count
  from public.babyfoot_entries e
  where e.tournament_id = NEW.tournament_id
    and e.id <> NEW.id
    and (
      (e.kind = 'official' and exists (
        select 1 from public.team_memberships tm where tm.team_id = e.team_id and tm.user_id = any(new_players)))
      or (e.kind = 'open' and (e.p1_user_id = any(new_players) or e.p2_user_id = any(new_players)))
    );
  if conflict_count > 0 then
    raise exception 'Un des joueurs est déjà engagé dans un binôme pour cette édition.'
      using errcode = 'unique_violation';
  end if;

  return NEW;
end;
$$;

commit;
