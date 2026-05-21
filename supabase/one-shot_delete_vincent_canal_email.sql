-- One-shot : supprime TOUS les enregistrements liés à
-- vincent.trouillat@canal-plus.com (test orphelin du parcours signup).
--
-- Ordre :
--   1. auth.users → cascade automatique vers public.users (FK auth_id
--      ON DELETE CASCADE) → cascade vers predictions, quiz_answers,
--      team_memberships, etc.
--   2. allowlist_users (pas de FK depuis cette table)
--
-- Vincent garde son compte trouillatv@gmail.com intact.

begin;

-- 1. auth.users → tous les profils en aval s'effacent via FK cascade.
delete from auth.users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');

-- 2. allowlist_users (entrée gérée séparément).
delete from public.allowlist_users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');

commit;

-- Audit : doit retourner 0 sur les 3 lignes ci-dessous.
select count(*) as remaining_auth from auth.users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');
select count(*) as remaining_users from public.users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');
select count(*) as remaining_allowlist from public.allowlist_users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');
