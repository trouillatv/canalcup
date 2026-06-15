-- ============================================================================
--  migration_match_lineups_player_id.sql
--  Ajoute match_lineups.player_id (id API-Football du joueur).
--  Sert à : URL photo (media.api-sports.io/football/players/{id}.png) et
--  jointure fiable avec player_match_stats (notes) pour la vue « Terrain ».
--
--  Le schéma live ne possédait pas cette colonne (≠ migration_live_match_v3).
--  Idempotent — peut être relancé sans danger.
-- ============================================================================

ALTER TABLE public.match_lineups ADD COLUMN IF NOT EXISTS player_id text;
