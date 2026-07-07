-- Règle métier NON contournable : un binôme baby-foot = EXACTEMENT 2 joueurs,
-- et un joueur ne peut appartenir qu'à UN seul binôme engagé PAR ÉDITION.
--
-- Garantie au niveau BASE (trigger) : aucune inscription invalide ne peut être
-- créée, même en contournant l'UI/API. La contrainte est SCOPÉE au tournoi
-- (tournament_id) → l'année suivante (nouvelle édition) les mêmes joueurs
-- peuvent reformer / changer de binôme.
--
-- Source des membres : team_memberships (un binôme = une équipe teams de 2).

begin;

create or replace function public.babyfoot_entry_validate()
returns trigger
language plpgsql
as $$
declare
  member_count int;
  conflict_count int;
begin
  -- 1) Exactement 2 joueurs dans l'équipe.
  select count(*) into member_count
  from public.team_memberships
  where team_id = NEW.team_id;

  if member_count <> 2 then
    raise exception 'Un binôme baby-foot doit compter exactement 2 joueurs (cette équipe en a %).', member_count
      using errcode = 'check_violation';
  end if;

  -- 2) Aucun des 2 joueurs déjà engagé dans un AUTRE binôme de la MÊME édition.
  select count(*) into conflict_count
  from public.babyfoot_entries e
  join public.team_memberships tm_other on tm_other.team_id = e.team_id
  where e.tournament_id = NEW.tournament_id
    and e.id <> NEW.id
    and tm_other.user_id in (
      select user_id from public.team_memberships where team_id = NEW.team_id
    );

  if conflict_count > 0 then
    raise exception 'Un des joueurs est déjà engagé dans un autre binôme pour cette édition.'
      using errcode = 'unique_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_babyfoot_entry_validate on public.babyfoot_entries;
create trigger trg_babyfoot_entry_validate
  before insert or update on public.babyfoot_entries
  for each row execute function public.babyfoot_entry_validate();

commit;
