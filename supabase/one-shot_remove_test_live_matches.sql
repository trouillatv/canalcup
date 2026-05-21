-- Supprime les matchs de TEST (phase='Test live') créés par
-- scripts/seed-live-test-match.js et leurs events/lineups/stats
-- (cascade auto via FK on delete cascade).
delete from public.matches where phase = 'Test live';

select
  (select count(*) from public.matches where phase = 'Test live') as remaining_test_matches,
  (select count(*) from public.matches where status = 'live') as live_remaining;
