-- ============================================================================
--  migration_supporter_photo2_v1.sql — 2e image "bonus" par binôme
--  À exécuter via : node scripts/migrate.js --file supabase/migration_supporter_photo2_v1.sql
--
--  Choix produit : on garde UNE entrée votable par binôme (unique team_id
--  inchangée, votes/réactions/commentaires toujours attachés à entry_id), et on
--  ajoute une 2e image "bonus" simplement affichée à côté (pas votée à part).
--  Migration purement ADDITIVE (colonnes nullables) : aucun risque en live.
-- ============================================================================

alter table public.supporter_photo_entries
  add column if not exists photo_url_2  text;

alter table public.supporter_photo_entries
  add column if not exists media_type_2 text;
