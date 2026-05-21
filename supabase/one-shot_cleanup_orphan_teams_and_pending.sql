-- Nettoyage ciblé :
--   1. Supprime les demandes pending vers des équipes orphelines.
--   2. Supprime les équipes user-créées (created_by_user_id NOT NULL)
--      qui n'ont plus aucun membre.
--   Les anciennes équipes seed legacy (created_by_user_id NULL) sont
--   conservées : elles sont référencées par revivez_posts et autres
--   tables non-cascade.

begin;

-- 1. Annule TOUTES les demandes pending (pré-prod : reset propre).
delete from public.team_join_requests
 where status = 'pending';

-- 2. Supprime les équipes user-créées orphelines.
delete from public.teams
 where created_by_user_id is not null
   and id not in (
     select team_id from public.team_memberships
   );

commit;

select
  (select count(*) from public.teams) as teams_remaining,
  (select count(*) from public.team_join_requests where status = 'pending') as pending_remaining,
  (select count(*) from public.teams where created_by_user_id is not null) as user_created_remaining;
