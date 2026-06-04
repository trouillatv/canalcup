-- Match de TEST : France - Côte d'Ivoire (amical), demain soir.
-- Jeudi 5 juin 2026, 21:00 Paris (= 19:00 UTC). Statut 'upcoming' → pronos
-- ouverts pour TOUS les utilisateurs jusqu'au coup d'envoi. Idempotent :
-- ne réinsère pas si déjà présent.
--
-- phase 'Groupe' = multiplicateur ×1 (barème simple : exact +10, bon résultat
-- +5, bonne diff +3) pour compter facilement les bons pronos.
-- is_match_of_week = true pour le mettre en évidence.

insert into public.matches
  (competition, team_a, team_b, flag_a, flag_b, starts_at, channel, status, phase, is_match_of_week, is_settled)
select
  'Amical international', 'France', 'Côte d''Ivoire', '🇫🇷', '🇨🇮',
  '2026-06-05T19:00:00+00', 'Canal+', 'upcoming', 'Groupe', true, false
where not exists (
  select 1 from public.matches where team_a = 'France' and team_b = 'Côte d''Ivoire'
);
