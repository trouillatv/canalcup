-- Diagnostic profond : Supabase Auth utilise plusieurs tables. Un
-- DELETE FROM auth.users peut laisser des restes dans auth.identities
-- si la FK n'est pas en CASCADE, ce qui fait que signUp renvoie
-- "already registered" même quand auth.users est vide.
select
  (select count(*) from auth.users where lower(email) = 'vincent.trouillat@canal-plus.com') as auth_users,
  (select count(*) from auth.identities where (identity_data->>'email') ilike 'vincent.trouillat@canal-plus.com') as auth_identities,
  (select count(*) from auth.users where confirmation_token is not null) as pending_total;
