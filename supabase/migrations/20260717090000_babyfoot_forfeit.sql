-- Baby-foot — FORFAIT d'un binôme.
--
-- Un binôme qui déclare forfait en cours d'édition ne « participe » pas : il ne
-- touche AUCUN point (pas même les 5 de participation), ses matchs restants sont
-- annulés et ses adversaires gagnent par forfait. Le binôme reste inscrit (on
-- garde la trace + le match perdu par forfait), il est juste hors barème et
-- hors qualification.
--
-- Idempotente.

begin;

alter table public.babyfoot_entries
  add column if not exists forfeited boolean not null default false;

comment on column public.babyfoot_entries.forfeited is
  'Binôme déclaré forfait : exclu du barème (0 point) et de la qualification.';

commit;
