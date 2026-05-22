-- Ajoute le service "Commerce" à la liste des services (onboarding / profil).
-- Idempotent : ré-exécutable sans doublon.
--
-- NB : la table public.services en base n'a PAS de colonne emoji (la
-- migration_users_v2 n'a jamais été appliquée). On insère donc uniquement
-- name / sort_order / is_active, comme les lignes existantes.
--
-- Placement : "Commerce" juste avant "Autre", qui doit rester en dernier.

update public.services set sort_order = 10 where name = 'Autre';

insert into public.services (name, sort_order, is_active)
select 'Commerce', 9, true
where not exists (
  select 1 from public.services where name = 'Commerce'
);
