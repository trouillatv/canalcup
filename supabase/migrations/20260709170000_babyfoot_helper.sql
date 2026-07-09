-- ============================================================================
-- Baby-foot : coéquipier « EN RENFORT » (règle produit validée).
--
-- Une personne sans binôme (p1) peut jouer avec un collègue DÉJÀ inscrit dans
-- un autre binôme (p2, renfort). Dans ce cas :
--   · l'inscription affiche « Vincent + Jeff en renfort » ;
--   · SEUL p1 marque des points (individuels) ;
--   · le renfort (p2) ne gagne RIEN et son inscription officielle reste intacte ;
--   · aucun point équipe (paire ad-hoc → team_id NULL sur les awards).
--
-- Techniquement : babyfoot_entries.p2_is_helper. Quand true, p2 ne « consomme »
-- pas d'engagement → il peut déjà être engagé ailleurs dans la même édition.
-- La règle « 1 joueur = 1 inscription » continue de s'appliquer aux joueurs
-- RÉELS (p1 toujours, p2 seulement si pas renfort).
-- ============================================================================

begin;

alter table public.babyfoot_entries
  add column if not exists p2_is_helper boolean not null default false;

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
    -- Le renfort (p2_is_helper) ne consomme pas d'engagement : seuls les joueurs
    -- RÉELS sont vérifiés (p1 toujours, p2 si pas renfort).
    if NEW.p2_is_helper then new_players := array[NEW.p1_user_id];
    else new_players := array[NEW.p1_user_id, NEW.p2_user_id]; end if;
  end if;

  -- Aucun joueur RÉEL déjà engagé (réellement) dans une autre inscription de la
  -- même édition : membre d'un binôme officiel, p1 d'une paire, ou p2 non-renfort.
  select count(*) into conflict_count
  from public.babyfoot_entries e
  where e.tournament_id = NEW.tournament_id
    and e.id <> NEW.id
    and (
      (e.kind = 'official' and exists (
        select 1 from public.team_memberships tm where tm.team_id = e.team_id and tm.user_id = any(new_players)))
      or (e.kind = 'open' and e.p1_user_id = any(new_players))
      or (e.kind = 'open' and e.p2_is_helper = false and e.p2_user_id = any(new_players))
    );
  if conflict_count > 0 then
    raise exception 'Un des joueurs est déjà engagé dans un binôme pour cette édition.'
      using errcode = 'unique_violation';
  end if;

  return NEW;
end;
$$;

commit;
