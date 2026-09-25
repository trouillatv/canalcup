-- Lot 2B — import réel (Tâche #27). Généré depuis Canal Cup en lecture seule.
-- 10 organizations, 45 users, 43 memberships. Voir docs/dry-runs/lot2b-preflight-import-2026-09-25.json.
begin;

-- Garde-fou : refuse l'import si la cible n'est plus vide ou si une collision existe déjà.
do $guard$
declare
  v_existing_orgs int;
  v_existing_users int;
  v_slug_collisions int;
  v_email_collisions int;
begin
  select count(*) into v_existing_orgs from public.organizations;
  select count(*) into v_existing_users from public.users;
  select count(*) into v_slug_collisions from public.organizations where slug = any(array['si','crc','boutique','ventes-directes','marketing','comptabilite','technique','direction','commerce','autre']);
  select count(*) into v_email_collisions from public.users where lower(email) = any(array['aurelie.decooman@canal-plus.com','rina.kumar@canal-plus.com','mohea.mens@canal-plus.com','killian.henriot@canal-plus.com','julijos.soekidjan@canal-plus.com','christel.sakiman@canal-plus.com','agathe.delacheisserie@canal-plus.com','david.wiria@canal-plus.com','selma.uygun@canal-plus.com','valentin.sevin@canal-plus.com','caroline.qenegei@canal-plus.com','oceane.hermantmelas@canal-plus.com','soraya.nguyen@canal-plus.com','marie-loane.diemene@canal-plus.com','leila.wohler@canal-plus.com','matthieu.petit@canal-plus.com','veronique.petitjean@canal-plus.com','marie.lucas@canal-plus.com','sophie.barbier@canal-plus.com','nathalie.costeseque@canal-plus.com','alain.celaries@canal-plus.com','eric.veyret@canal-plus.com','manon.mitton@canal-plus.com','rodolphe.picard@canal-plus.com','julie.decooman@canal-plus.com','sacha.lehe@canal-plus.com','miguel.rainal@canal-plus.com','marie-marthe.hnalep@canal-plus.com','anais.morel@canal-plus.com','capucine.albisetti@canal-plus.com','sylvie.tambunan@canal-plus.com','laetitia.puccianti@canal-plus.com','justine.levos@canal-plus.com','valerie.tanzilli@canal-plus.com','jean-frederic.schmitt@canal-plus.com','tuhiti.tuahine@canal-plus.com','christian.helme@canal-plus.com','helene.adrey@canal-plus.com','karl.michelon@canal-plus.com','audrey.tanghmelen@canal-plus.com','nicolas.gorget@canal-plus.com','monalisa.tufele@canal-plus.com','foulques.lauzin@canal-plus.com','gabrielle.milin@canal-plus.com','wendykumar@canal-plus.com']);
  if v_existing_orgs <> 0 or v_existing_users <> 0 then
    raise exception 'ABORT import: organizations/users non vides (org=%, users=%) — attendu 0/0', v_existing_orgs, v_existing_users;
  end if;
  if v_slug_collisions <> 0 then
    raise exception 'ABORT import: % collision(s) de slug organizations détectée(s)', v_slug_collisions;
  end if;
  if v_email_collisions <> 0 then
    raise exception 'ABORT import: % collision(s) d''email users détectée(s)', v_email_collisions;
  end if;
end $guard$;

-- 1. Organisations (10)
insert into public.organizations (type, slug, name, parent_id, metadata) values
  ('service', 'si', 'SI', null, '{}'::jsonb),
  ('service', 'crc', 'CRC', null, '{}'::jsonb),
  ('service', 'boutique', 'Boutique', null, '{}'::jsonb),
  ('service', 'ventes-directes', 'Ventes Directes', null, '{}'::jsonb),
  ('service', 'marketing', 'Marketing', null, '{}'::jsonb),
  ('service', 'comptabilite', 'Comptabilité', null, '{}'::jsonb),
  ('service', 'technique', 'Technique', null, '{}'::jsonb),
  ('service', 'direction', 'Direction', null, '{}'::jsonb),
  ('service', 'commerce', 'Commerce', null, '{}'::jsonb),
  ('service', 'autre', 'Autre', null, '{}'::jsonb);

-- 2. Utilisateurs (45 : 43 avec membership + 2 sans)
insert into public.users (email, name, display_name, timezone) values
  ('aurelie.decooman@canal-plus.com', 'Lili C+', 'Lili C+', 'Pacific/Noumea'),
  ('rina.kumar@canal-plus.com', 'Rina', 'Rina', 'Pacific/Noumea'),
  ('mohea.mens@canal-plus.com', 'Mo''', 'Mo''', 'Pacific/Noumea'),
  ('killian.henriot@canal-plus.com', 'Killian', 'Killian', 'Pacific/Noumea'),
  ('julijos.soekidjan@canal-plus.com', 'Pegase', 'Pegase', 'Pacific/Noumea'),
  ('christel.sakiman@canal-plus.com', 'Kriss', 'Kriss', 'Pacific/Noumea'),
  ('agathe.delacheisserie@canal-plus.com', 'Agathe', 'Agathe', 'Pacific/Noumea'),
  ('david.wiria@canal-plus.com', 'Tonton D', 'Tonton D', 'Pacific/Noumea'),
  ('selma.uygun@canal-plus.com', 'Selmouche', 'Selmouche', 'Pacific/Noumea'),
  ('valentin.sevin@canal-plus.com', 'El Valentinho', 'El Valentinho', 'Pacific/Noumea'),
  ('caroline.qenegei@canal-plus.com', 'CAROALLÉLESBLEUS', 'CAROALLÉLESBLEUS', 'Pacific/Noumea'),
  ('oceane.hermantmelas@canal-plus.com', 'Océane', 'Océane', 'Pacific/Noumea'),
  ('soraya.nguyen@canal-plus.com', 'Soy', 'Soy', 'Pacific/Noumea'),
  ('marie-loane.diemene@canal-plus.com', 'Marylolo', 'Marylolo', 'Pacific/Noumea'),
  ('leila.wohler@canal-plus.com', 'Je m''en FOOT (ou pas)', 'Je m''en FOOT (ou pas)', 'Pacific/Noumea'),
  ('matthieu.petit@canal-plus.com', 'AimePi', 'AimePi', 'Pacific/Noumea'),
  ('veronique.petitjean@canal-plus.com', 'Foutix', 'Foutix', 'Pacific/Noumea'),
  ('marie.lucas@canal-plus.com', 'MAWI', 'MAWI', 'Pacific/Noumea'),
  ('sophie.barbier@canal-plus.com', 'SOFOUFOOT', 'SOFOUFOOT', 'Pacific/Noumea'),
  ('nathalie.costeseque@canal-plus.com', 'NATOCHE', 'NATOCHE', 'Pacific/Noumea'),
  ('alain.celaries@canal-plus.com', '🏃‍♀️💨⚽⚡🥅🎯Mbappé TROL 🔥', '🏃‍♀️💨⚽⚡🥅🎯Mbappé TROL 🔥', 'Pacific/Noumea'),
  ('eric.veyret@canal-plus.com', 'Erve', 'Erve', 'Pacific/Noumea'),
  ('manon.mitton@canal-plus.com', 'Manonito', 'Manonito', 'Pacific/Noumea'),
  ('rodolphe.picard@canal-plus.com', 'Les lions de PARIS', 'Les lions de PARIS', 'Pacific/Noumea'),
  ('julie.decooman@canal-plus.com', 'JULIE', 'JULIE', 'Pacific/Noumea'),
  ('sacha.lehe@canal-plus.com', 'Sacha', 'Sacha', 'Pacific/Noumea'),
  ('miguel.rainal@canal-plus.com', 'Miguelito', 'Miguelito', 'Pacific/Noumea'),
  ('marie-marthe.hnalep@canal-plus.com', 'Laurya', 'Laurya', 'Pacific/Noumea'),
  ('anais.morel@canal-plus.com', 'Anaïs', 'Anaïs', 'Pacific/Noumea'),
  ('capucine.albisetti@canal-plus.com', 'FC Roberta', 'FC Roberta', 'Pacific/Noumea'),
  ('sylvie.tambunan@canal-plus.com', 'Jpréfèrlehockey', 'Jpréfèrlehockey', 'Pacific/Noumea'),
  ('laetitia.puccianti@canal-plus.com', 'Léty de Koné', 'Léty de Koné', 'Pacific/Noumea'),
  ('justine.levos@canal-plus.com', 'Coco deschamps', 'Coco deschamps', 'Pacific/Tahiti'),
  ('valerie.tanzilli@canal-plus.com', 'ValyFoot', 'ValyFoot', 'Pacific/Noumea'),
  ('jean-frederic.schmitt@canal-plus.com', 'JEFF', 'JEFF', 'Pacific/Noumea'),
  ('tuhiti.tuahine@canal-plus.com', 'Tahitian boy 🌺', 'Tahitian boy 🌺', 'Pacific/Tahiti'),
  ('christian.helme@canal-plus.com', 'Christian', 'Christian', 'Pacific/Tahiti'),
  ('helene.adrey@canal-plus.com', 'Helene', 'Helene', 'Pacific/Noumea'),
  ('karl.michelon@canal-plus.com', 'Karl', 'Karl', 'Pacific/Noumea'),
  ('audrey.tanghmelen@canal-plus.com', 'Oh oh', 'Oh oh', 'Pacific/Noumea'),
  ('nicolas.gorget@canal-plus.com', 'NICOLAS', 'NICOLAS', 'Pacific/Noumea'),
  ('monalisa.tufele@canal-plus.com', 'La Joconde', 'La Joconde', 'Pacific/Noumea'),
  ('foulques.lauzin@canal-plus.com', 'Foulques', 'Foulques', 'Pacific/Noumea'),
  ('gabrielle.milin@canal-plus.com', 'gabrielle.milin', null, 'Pacific/Noumea'),
  ('wendykumar@canal-plus.com', 'wendykumar', null, 'Pacific/Noumea');

-- 3. Memberships (43) — jointure par email/slug, pas d'UUID en dur
with target(email, slug) as (values
  ('aurelie.decooman@canal-plus.com', 'commerce'),
  ('rina.kumar@canal-plus.com', 'ventes-directes'),
  ('mohea.mens@canal-plus.com', 'crc'),
  ('killian.henriot@canal-plus.com', 'crc'),
  ('julijos.soekidjan@canal-plus.com', 'si'),
  ('christel.sakiman@canal-plus.com', 'si'),
  ('agathe.delacheisserie@canal-plus.com', 'direction'),
  ('david.wiria@canal-plus.com', 'si'),
  ('selma.uygun@canal-plus.com', 'marketing'),
  ('valentin.sevin@canal-plus.com', 'commerce'),
  ('caroline.qenegei@canal-plus.com', 'marketing'),
  ('oceane.hermantmelas@canal-plus.com', 'technique'),
  ('soraya.nguyen@canal-plus.com', 'marketing'),
  ('marie-loane.diemene@canal-plus.com', 'marketing'),
  ('leila.wohler@canal-plus.com', 'marketing'),
  ('matthieu.petit@canal-plus.com', 'direction'),
  ('veronique.petitjean@canal-plus.com', 'boutique'),
  ('marie.lucas@canal-plus.com', 'marketing'),
  ('sophie.barbier@canal-plus.com', 'marketing'),
  ('nathalie.costeseque@canal-plus.com', 'autre'),
  ('alain.celaries@canal-plus.com', 'si'),
  ('eric.veyret@canal-plus.com', 'autre'),
  ('manon.mitton@canal-plus.com', 'ventes-directes'),
  ('rodolphe.picard@canal-plus.com', 'commerce'),
  ('julie.decooman@canal-plus.com', 'crc'),
  ('sacha.lehe@canal-plus.com', 'ventes-directes'),
  ('miguel.rainal@canal-plus.com', 'ventes-directes'),
  ('marie-marthe.hnalep@canal-plus.com', 'commerce'),
  ('anais.morel@canal-plus.com', 'marketing'),
  ('capucine.albisetti@canal-plus.com', 'comptabilite'),
  ('sylvie.tambunan@canal-plus.com', 'technique'),
  ('laetitia.puccianti@canal-plus.com', 'commerce'),
  ('justine.levos@canal-plus.com', 'commerce'),
  ('valerie.tanzilli@canal-plus.com', 'comptabilite'),
  ('jean-frederic.schmitt@canal-plus.com', 'technique'),
  ('tuhiti.tuahine@canal-plus.com', 'commerce'),
  ('christian.helme@canal-plus.com', 'commerce'),
  ('helene.adrey@canal-plus.com', 'marketing'),
  ('karl.michelon@canal-plus.com', 'commerce'),
  ('audrey.tanghmelen@canal-plus.com', 'boutique'),
  ('nicolas.gorget@canal-plus.com', 'commerce'),
  ('monalisa.tufele@canal-plus.com', 'crc'),
  ('foulques.lauzin@canal-plus.com', 'comptabilite')
)
insert into public.memberships (user_id, organization_id, role, is_primary)
select usr.id, org.id, 'member', true
from target t
join public.users usr on usr.email = t.email
join public.organizations org on org.slug = t.slug;

-- Garde-fou final : totaux exacts avant commit, sinon rollback.
do $post$
declare
  v_orgs int; v_users int; v_memberships int;
begin
  select count(*) into v_orgs from public.organizations;
  select count(*) into v_users from public.users;
  select count(*) into v_memberships from public.memberships;
  if v_orgs <> 10 or v_users <> 45 or v_memberships <> 43 then
    raise exception 'ABORT import: totaux inattendus après écriture — organizations=%, users=%, memberships=% (attendu 10/45/43)', v_orgs, v_users, v_memberships;
  end if;
end $post$;

commit;
