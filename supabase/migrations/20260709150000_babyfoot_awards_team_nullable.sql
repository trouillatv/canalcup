-- Les paires ad-hoc (kind='open') n'ont pas d'équipe : leurs awards portent
-- team_id NULL (→ aucun point équipe). La colonne doit donc être nullable,
-- sinon l'insertion en bloc de recomputeAwards échoue dès qu'une paire ad-hoc
-- est présente.
begin;
alter table public.babyfoot_awards alter column team_id drop not null;
commit;
