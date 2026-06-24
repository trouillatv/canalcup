-- ─────────────────────────────────────────────────────────────────────────────
--  Jet Lag (refonte du joker "Retard d'Avion") — v1
--  Le Jet Lag re-juge le prono de la victime sur la SEULE 2e mi-temps :
--      2e mi-temps = score plein temps − score mi-temps.
--  Il faut donc persister le score à la mi-temps des matchs (absent jusqu'ici).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_ht_a smallint;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS score_ht_b smallint;

COMMENT ON COLUMN matches.score_ht_a IS 'Buts équipe A à la mi-temps (cumulé 45''). 2e MT = score_a - score_ht_a.';
COMMENT ON COLUMN matches.score_ht_b IS 'Buts équipe B à la mi-temps (cumulé 45''). 2e MT = score_b - score_ht_b.';
