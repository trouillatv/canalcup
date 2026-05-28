-- Match de TEST : finale Ligue des Champions PSG - Arsenal.
-- Samedi 30 mai 2026, 18:00 Paris (= 16:00 UTC = 03:00 NC dimanche 31).
-- Statut 'upcoming' → pronos ouverts pour tous les utilisateurs jusqu'au coup
-- d'envoi. Idempotent : ne réinsère pas si déjà présent.
--
-- phase 'Finale' (multiplicateur par défaut côté barème ; le scoring s'applique
-- automatiquement au coup de sifflet final via settleAllFinished).
insert into public.matches
  (competition, team_a, team_b, flag_a, flag_b, starts_at, channel, status, phase, is_match_of_week, is_settled)
select
  'Ligue des Champions', 'PSG', 'Arsenal', '🇫🇷', '🇬🇧',
  '2026-05-30T16:00:00+00', 'Canal+', 'upcoming', 'Finale', false, false
where not exists (
  select 1 from public.matches where team_a = 'PSG' and team_b = 'Arsenal'
);
