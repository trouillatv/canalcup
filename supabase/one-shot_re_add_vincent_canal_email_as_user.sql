-- One-shot : ré-ajoute vincent.trouillat@canal-plus.com à l'allowlist
-- comme simple participant (role='user') pour que Vincent puisse
-- tester le parcours "Créer un compte" depuis l'écran de connexion.
--
-- N.B. : ça pré-autorise UNIQUEMENT — le compte auth.users sera créé
-- au moment où Vincent cliquera "Créer un compte".
insert into public.allowlist_users (email, role, is_active)
values ('vincent.trouillat@canal-plus.com', 'user', true)
on conflict (email) do update
  set role = 'user', is_active = true;
