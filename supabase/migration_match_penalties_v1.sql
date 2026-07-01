-- ============================================================================
--  migration_match_penalties_v1.sql
--  Score des TIRS AU BUT (séance de penalties) stocké à part.
--  À exécuter : node scripts/migrate.js --file supabase/migration_match_penalties_v1.sql
--
--  En phase finale, un match nul après prolongation se décide aux tirs au but.
--  L'API (API-Football `score.penalty`) renvoie le résultat de la séance, mais
--  `goals` (→ score_a/score_b) reste à égalité (t.a.b. exclus). Sans cette
--  donnée, le tableau ne pouvait PAS désigner le qualifié (cf. bracket-2026.ts,
--  « égalité = TAB, indécidable »). On conserve désormais la séance dans
--  pen_a/pen_b : le vainqueur du bracket = plus de tirs au but marqués quand le
--  score réglementaire/prolongation est nul. Ces colonnes NE changent RIEN au
--  scoring des pronos (qui porte sur le temps réglementaire, cf. score_reg_*).
-- ============================================================================

alter table public.matches add column if not exists pen_a int;
alter table public.matches add column if not exists pen_b int;
