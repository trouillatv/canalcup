-- Aligne le match de test sur l'ordre du provider API-Football :
-- Crystal Palace (domicile) vs Rayo Vallecano (extérieur), comme un vrai match
-- WC créé depuis le provider (team_a = home → score_a = goals.home).
-- On retourne aussi les pronos déjà saisis pour qu'ils restent corrects.

-- 1. Retourner les pronostics existants (score A<->B, résultat A<->B).
update public.predictions
set predicted_score_a = predicted_score_b,
    predicted_score_b = predicted_score_a,
    prediction_result = case prediction_result when 'A' then 'B' when 'B' then 'A' else 'DRAW' end
where match_id = (select id from public.matches where team_a = 'Rayo Vallecano' and team_b = 'Crystal Palace');

-- 2. Remettre les équipes dans l'ordre de l'API (domicile = Crystal Palace).
update public.matches
set team_a = 'Crystal Palace', team_b = 'Rayo Vallecano', flag_a = '🇬🇧', flag_b = '🇪🇸'
where team_a = 'Rayo Vallecano' and team_b = 'Crystal Palace';
