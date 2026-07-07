-- APPLY — déplace 2 pronos (France/Sénégal + Iraq/Norvège) admin -> vincent.trouillat
-- Ciblage par PK exacte + garde user_id source. Réversible : ré-exécuter en
-- inversant user_id pour annuler. team_id remis à NULL (profil cible sans équipe).
UPDATE public.predictions
SET user_id = '8a6489bc-9a62-4429-99be-cf504220a755',  -- vincent.trouillat@canal-plus.com
    team_id = NULL
WHERE id IN (
  '65df797f-b460-4774-a23e-1cd26d877c3e',  -- France / Sénégal
  'd6046e9b-4ab4-4b18-96b9-e19325eb87a9'   -- Iraq / Norvège
)
AND user_id = 'd6c77233-96c5-43fe-bbd3-e7ea26754ab5'  -- source = compte admin
RETURNING id, user_id, team_id, match_id, predicted_score_a, predicted_score_b, points_awarded;
