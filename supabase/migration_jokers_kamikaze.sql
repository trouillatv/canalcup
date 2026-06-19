-- ============================================================================
--  migration_jokers_kamikaze.sql — ajoute le joker 'kamikaze'
--  À exécuter via : node scripts/migrate.js --file supabase/migration_jokers_kamikaze.sql
--  Idempotent (drop constraint if exists / recreate).
--
--  💣 Kamikaze : sur un match futur déjà pronostiqué — score exact = +30,
--  bon résultat = 0, raté = −15. Résolu au settlement (comme Quitte ou Double).
-- ============================================================================

alter table public.joker_wallets drop constraint if exists joker_wallets_joker_type_check;
alter table public.joker_wallets add constraint joker_wallets_joker_type_check
  check (joker_type in ('casino','quitte_ou_double','kamikaze','carton_rouge','brouillard','espion','var','retard_avion'));

alter table public.joker_plays drop constraint if exists joker_plays_joker_type_check;
alter table public.joker_plays add constraint joker_plays_joker_type_check
  check (joker_type in ('casino','quitte_ou_double','kamikaze','carton_rouge','brouillard','espion','var','retard_avion'));
