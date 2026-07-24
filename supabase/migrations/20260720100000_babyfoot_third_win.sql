-- Baby-foot : la petite finale gagnée rapporte enfin des points.
--
-- Jusqu'ici le barème ne connaissait aucun palier pour la 3e place : le
-- vainqueur et le perdant de la petite finale repartaient avec un total
-- IDENTIQUE (édition 2026 : Les perchés 40 pts = ChoubiX 40 pts). Le match ne
-- servait qu'à trancher final_rank 3 vs 4, donc l'ordre d'affichage du podium
-- — aucun enjeu de score.
--
-- Nouveau palier `third_win` = 10 pts (aligné sur `qualified`), qui porte le 3e
-- à 50 pts. L'ordre reste strict : champion 80 > finaliste 55 > 3e 50 > 4e 40.
-- On ne touche PAS au perdant : finir 4e reste à 40.
--
-- Cette migration n'ajoute que la valeur autorisée dans le check constraint.
-- Le registre lui-même est réécrit intégralement par recomputeAwards (delete +
-- insert) à la première recompute — inutile de faire un UPDATE ici, et ce
-- serait même faux : le moteur reste la seule source des points.

begin;

alter table public.babyfoot_awards drop constraint if exists babyfoot_awards_stage_check;
alter table public.babyfoot_awards
  add constraint babyfoot_awards_stage_check
  check (stage in ('participation','phase1','qualified','semi_win','third_win','champion'));

commit;
