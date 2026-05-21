-- One-shot : retire vincent.trouillat@canal-plus.com de l'allowlist
-- pour vérifier que l'auto-allowlist par domaine (@canal-plus.com)
-- fonctionne au prochain "Créer un compte". Si le test passe, on a la
-- preuve que les futurs employés Canal+ pourront s'inscrire seuls.
delete from public.allowlist_users
 where lower(email) = lower('vincent.trouillat@canal-plus.com');
