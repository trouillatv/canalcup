-- One-shot : rétrograde vincent.trouillat@canal-plus.com en simple
-- joueur (user). Vincent veut tester le compte comme un participant
-- lambda. Ses droits admin restent attachés à trouillatv@gmail.com.
update public.allowlist_users
   set role = 'user',
       is_active = true
 where email = 'vincent.trouillat@canal-plus.com';
