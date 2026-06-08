-- Match de TEST : France - Irlande du Nord (amical), demain matin NC.
-- Mardi 9 juin 2026, 06:10 Nouvelle-Calédonie (= 2026-06-08 19:10 UTC).
-- Statut 'upcoming' → pronos ouverts pour TOUS jusqu'au coup d'envoi.
-- Idempotent : ne réinsère pas si déjà présent.
--
-- Pas de drapeaux (flag_a / flag_b laissés NULL) : affichage par nom seul.
-- phase 'Groupe' = multiplicateur ×1 (barème simple). is_match_of_week = true
-- pour le mettre en évidence sur l'accueil.

insert into public.matches
  (competition, team_a, team_b, starts_at, channel, status, phase, is_match_of_week, is_settled)
select
  'Amical international', 'France', 'Irlande du Nord',
  '2026-06-08T19:10:00+00', 'Canal+', 'upcoming', 'Groupe', true, false
where not exists (
  select 1 from public.matches where team_a = 'France' and team_b = 'Irlande du Nord'
);
