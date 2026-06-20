-- ============================================================================
--  migration_player_match_stats_card_v1.sql
--  Étend player_match_stats pour alimenter la fiche joueur football
--  (Forme / Mondial / Indice Dangerosité), qui a besoin du temps de jeu et de
--  la titularisation — non stockés jusqu'ici — ainsi que des passes clés et
--  duels gagnés (déjà fournis par /fixtures/players mais non persistés).
--
--    minutes    : minutes jouées dans le match (games.minutes)
--    started    : true = titulaire (games.substitute = false)
--    duels_won  : duels gagnés (duels.won)
--    key_passes : passes clés (passes.key)
--
--  Toutes nullable (l'API ne fournit pas toujours la donnée → l'UI dégrade).
--  Idempotent — peut être relancé sans danger.
-- ============================================================================

ALTER TABLE public.player_match_stats ADD COLUMN IF NOT EXISTS minutes    int;
ALTER TABLE public.player_match_stats ADD COLUMN IF NOT EXISTS started     boolean;
ALTER TABLE public.player_match_stats ADD COLUMN IF NOT EXISTS duels_won   int;
ALTER TABLE public.player_match_stats ADD COLUMN IF NOT EXISTS key_passes  int;

-- Lecture fréquente par joueur (forme, Mondial, derniers matchs).
CREATE INDEX IF NOT EXISTS player_match_stats_player_idx
  ON public.player_match_stats (player_id);
