-- ============================================================================
--  one-shot_r32_to_seiziemes.sql
--  Reclasse les 16 matchs du tour à 32 équipes (libellé API "Round of 32"),
--  importés à tort en phase "Groupe" faute de mapping dans normalizePhase.
--  En français = 16es de finale → phase technique "Seizièmes".
--  À exécuter : node scripts/migrate.js --file supabase/one-shot_r32_to_seiziemes.sql
-- ============================================================================

update public.matches
set phase = 'Seizièmes',
    stage = null,
    updated_at = now()
where stage = 'Round of 32'
  and competition in ('Coupe du Monde 2026', 'FIFA World Cup 2026');
