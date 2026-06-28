-- ============================================================================
--  migration_match_regulation_score_v1.sql
--  Score du TEMPS RÉGLEMENTAIRE (90' + arrêts de jeu) stocké à part.
--  À exécuter : node scripts/migrate.js --file supabase/migration_match_regulation_score_v1.sql
--
--  Règle métier phase finale : les pronostics ne portent QUE sur le score à la
--  fin du temps réglementaire. Prolongations & tirs au but NE COMPTENT PAS.
--  Or l'API (API-Football `goals`) stocke le score APRÈS prolongation dans
--  matches.score_a/score_b. Le score réglementaire est `score.fulltime` → on le
--  conserve désormais dans score_reg_a/score_reg_b, et tout le scoring KO s'y
--  base (fallback sur score_a/score_b si non renseigné, ex. phase de groupes).
-- ============================================================================

alter table public.matches add column if not exists score_reg_a int;
alter table public.matches add column if not exists score_reg_b int;

-- Backfill : pour les matchs terminés, le score réglementaire = score affiché
-- (exact pour les poules, sans prolongation). Les matchs KO partis en
-- prolongation seront corrigés au prochain passage de la synchro (score.fulltime).
update public.matches
set score_reg_a = score_a,
    score_reg_b = score_b
where status = 'finished'
  and score_reg_a is null
  and score_a is not null
  and score_b is not null;
