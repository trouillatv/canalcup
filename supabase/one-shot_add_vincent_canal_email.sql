-- One-shot : ajoute vincent.trouillat@canal-plus.com à l'allowlist
-- comme super_admin (Vincent a 2 emails — gmail + canal-plus.com).
insert into public.allowlist_users (email, role, is_active)
values ('vincent.trouillat@canal-plus.com', 'super_admin', true)
on conflict (email) do update
  set role = 'super_admin', is_active = true;
