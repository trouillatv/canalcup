-- Supprime les équipes "Les Cassos" et "Les nazes" (comptes de test de l'admin),
-- en PRÉSERVANT les comptes utilisateurs et leurs données détachables.
--
-- Stratégie : détacher tout ce qui est nullable (les users restent, sans équipe ;
-- inbox et bonus conservés mais sans team_id) ; ne supprimer QUE ce qui est
-- NOT NULL et donc indissociable d'une équipe (predictions.team_id).
-- team_join_requests / team_memberships partent en CASCADE avec teams.
--
-- Idempotent. Ciblage par nom (2 équipes précises).

-- 1. Détacher les utilisateurs (ils restent, sans équipe).
update public.users
set team_id = null, team_role = 'member'
where team_id in (select id from public.teams where name in ('Les Cassos', 'Les nazes'));

-- 2. Détacher les enregistrements nullable (préservés).
update public.bonus_predictions
set team_id = null
where team_id in (select id from public.teams where name in ('Les Cassos', 'Les nazes'));

update public.inbox_events
set team_id = null
where team_id in (select id from public.teams where name in ('Les Cassos', 'Les nazes'));

-- 3. Supprimer ce qui est NOT NULL et indissociable de l'équipe.
delete from public.predictions
where team_id in (select id from public.teams where name in ('Les Cassos', 'Les nazes'));

-- 4. Supprimer les équipes (join_requests + memberships en CASCADE).
delete from public.teams
where name in ('Les Cassos', 'Les nazes');
