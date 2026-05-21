-- Audit après suppression : doit retourner 0,0,0.
select
  (select count(*) from auth.users where lower(email) = lower('vincent.trouillat@canal-plus.com')) as auth_users,
  (select count(*) from public.users where lower(email) = lower('vincent.trouillat@canal-plus.com')) as public_users,
  (select count(*) from public.allowlist_users where lower(email) = lower('vincent.trouillat@canal-plus.com')) as allowlist_users;
