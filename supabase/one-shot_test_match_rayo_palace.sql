-- Match de TEST pour valider le flux de pronostics avec les testeurs MVP.
-- Rayo Vallecano - Crystal Palace, demain soir (NC). Statut upcoming → pronos
-- ouverts pour TOUS les utilisateurs jusqu'au coup d'envoi. Idempotent.
--
-- phase 'Groupe' = multiplicateur ×1 (barème simple : exact +10, bon résultat
-- +5, bonne diff +3) pour compter facilement les bons pronos.
-- is_match_of_week = true pour le mettre en évidence.

insert into public.matches
  (competition, team_a, team_b, flag_a, flag_b, starts_at, channel, status, phase, is_match_of_week, is_settled)
select
  'Test - Coupe d''Europe', 'Rayo Vallecano', 'Crystal Palace', '🇪🇸', '🇬🇧',
  '2026-05-28T10:00:00+00', 'Canal+', 'upcoming', 'Groupe', true, false
where not exists (
  select 1 from public.matches where team_a = 'Rayo Vallecano' and team_b = 'Crystal Palace'
);
