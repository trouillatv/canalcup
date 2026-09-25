-- Exemples travaillés — Lot 1 (Sport/Competition/Season/Event/EventParticipant).
--
-- NE PAS EXÉCUTER TEL QUEL EN BASE. Ce fichier illustre comment représenter
-- trois cas réels dans le socle référentiel ; il ne doit jamais être joué
-- contre CANAL Sports pour "peupler" des résultats — le socle actuellement
-- en base ne contient que sports/competitions/seasons réels et statiques
-- (voir 20260925000000_referential_sport_model.sql). Toute donnée insérée
-- via ce fichier doit être explicitement marquée [EXEMPLE]/[TEST] dans son
-- `name`/`metadata`, et supprimée après usage (démo, test manuel) — jamais
-- laissée comme si elle était une donnée réelle.

-- =====================================================================
-- 1) Football — Ligue des Champions, 8e de finale ALLER (deux manches)
-- =====================================================================
-- PSG reçoit Liverpool au match aller. Le match retour est une DEUXIÈME
-- ligne Event, liée par `leg` + `metadata.tie_ref` (Addendum P2, point 2) —
-- pas une table "Tie" séparée.

with cl_season as (
  select id from public.seasons
  where label = '2025-2026'
    and competition_id = (select id from public.competitions where slug = 'uefa-champions-league')
),
psg as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'football'),
    'team', '[EXEMPLE] Paris Saint-Germain', 'PSG', 'FRA', 'example', 'psg-demo'
  )
  returning id
),
liverpool as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'football'),
    'team', '[EXEMPLE] Liverpool FC', 'LIV', 'ENG', 'example', 'liverpool-demo'
  )
  returning id
),
leg1 as (
  insert into public.events (
    season_id, starts_at, venue, status, stage, stage_order, matchday, leg,
    source, external_id, result, metadata
  )
  values (
    (select id from cl_season),
    '2026-02-17T20:00:00Z', 'Parc des Princes', 'scheduled',
    'Round of 16', 5, null, 1,
    'example', 'cl-r16-psg-liv-leg1-demo',
    '{}'::jsonb,
    '{"example": true, "tie_ref": "cl-r16-psg-liv-2026"}'::jsonb
  )
  returning id
)
insert into public.event_participants (event_id, participant_id, role)
select leg1.id, psg.id, 'home' from leg1, psg
union all
select leg1.id, liverpool.id, 'away' from leg1, liverpool;

-- Match retour (leg = 2), même tie_ref, résultat une fois joué :
-- update public.events set status = 'finished',
--   result = '{"home_score": 1, "away_score": 2, "periods": [{"home": 0, "away": 1}, {"home": 1, "away": 1}]}'::jsonb
-- where source = 'example' and external_id = 'cl-r16-psg-liv-leg2-demo';

-- =====================================================================
-- 2) Formule 1 — Grand Prix (N pilotes, pas de home/away)
-- =====================================================================
-- Illustre pourquoi Event n'a pas de home_team_id/away_team_id : un Event
-- F1 a autant de EventParticipant que de pilotes au départ, `role` porte la
-- position de départ (facultatif), le classement final vit dans
-- `result.classification` (pas un score à deux nombres).

with f1_season as (
  select id from public.seasons
  where label = '2026'
    and competition_id = (select id from public.competitions where slug = 'fia-f1-world-championship')
),
driver_a as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'f1'),
    'individual', '[EXEMPLE] Pilote A', 'A', 'MON', 'example', 'driver-a-demo'
  )
  returning id
),
driver_b as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'f1'),
    'individual', '[EXEMPLE] Pilote B', 'B', 'NED', 'example', 'driver-b-demo'
  )
  returning id
),
race as (
  insert into public.events (
    season_id, starts_at, venue, status, stage, source, external_id, result, metadata
  )
  values (
    (select id from f1_season),
    '2026-05-24T13:00:00Z', 'Circuit de Monaco', 'finished',
    'Race',
    'example', 'f1-monaco-2026-demo',
    '{"classification": [
        {"participant_ref": "driver-a-demo", "position": 1, "time": "1:32:04.123"},
        {"participant_ref": "driver-b-demo", "position": 2, "time": "+3.512"}
      ]}'::jsonb,
    '{"example": true}'::jsonb
  )
  returning id
)
insert into public.event_participants (event_id, participant_id, role)
select race.id, driver_a.id, 'grid_1' from race, driver_a
union all
select race.id, driver_b.id, 'grid_3' from race, driver_b;

-- Note : `result.classification` référence les pilotes par un identifiant
-- lisible ici pour la démo ; en pratique, une fois les participants créés,
-- on y mettrait le vrai `participant_id` (uuid), pas un texte libre.

-- =====================================================================
-- 3) Rugby — match à match unique (2 camps, comme le foot)
-- =====================================================================

with top14_season as (
  select id from public.seasons
  where label = '2025-2026'
    and competition_id = (select id from public.competitions where slug = 'top-14')
),
team_a as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'rugby'),
    'team', '[EXEMPLE] Stade Toulousain', 'STV', 'FRA', 'example', 'toulouse-demo'
  )
  returning id
),
team_b as (
  insert into public.participants (sport_id, type, name, short_name, country, source, external_id)
  values (
    (select id from public.sports where slug = 'rugby'),
    'team', '[EXEMPLE] Racing 92', 'R92', 'FRA', 'example', 'racing92-demo'
  )
  returning id
),
match as (
  insert into public.events (
    season_id, starts_at, venue, status, stage, matchday, source, external_id, result, metadata
  )
  values (
    (select id from top14_season),
    '2026-03-14T20:00:00Z', 'Stadium de Toulouse', 'finished',
    'Journée 20', 20,
    'example', 'top14-j20-tou-r92-demo',
    '{"home_score": 27, "away_score": 21, "tries": {"home": 3, "away": 2}}'::jsonb,
    '{"example": true}'::jsonb
  )
  returning id
)
insert into public.event_participants (event_id, participant_id, role)
select match.id, team_a.id, 'home' from match, team_a
union all
select match.id, team_b.id, 'away' from match, team_b;

-- =====================================================================
-- Nettoyage (à exécuter après une démo manuelle) :
-- =====================================================================
-- delete from public.events where source = 'example';
-- delete from public.participants where source = 'example';
