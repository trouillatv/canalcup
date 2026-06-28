-- migration_matches_knockout_v1
-- Insère le TABLEAU À ÉLIMINATION DIRECTE (Seizièmes → Finale, 32 matchs) avec
-- des EMPLACEMENTS PROVISOIRES (équipes non connues : « 1er Groupe E »,
-- « 3e A/B/C/D/F », « Vainqueur S1 »…). Objectif : ouvrir les pronos dès
-- maintenant, avant que les qualifiés soient connus.
--
-- Structure = lib/football/bracket-2026.ts (matrice officielle FIFA, matchs
-- 73→104). `stage` porte le code bracket (S1..S16, H1..H8, Q1..Q4, D1/D2, P3, F)
-- — il sert de CLÉ DE RÉCONCILIATION : quand les vraies équipes seront connues,
-- on met à jour (UPDATE) la ligne du même code au lieu d'en créer une nouvelle,
-- ce qui PRÉSERVE les pronos déjà saisis.
--
-- ⚠️ Dates = fenêtres officielles FIFA (28/06 → 19/07) réparties par n° FIFA,
--    en heure Nouvelle-Calédonie (+11). À AFFINER au tirage réel des affiches.
-- ⚠️ La synchro API-Football (services/football/sync.ts) réconcilie par apif_id
--    puis par NOM d'équipe. Tant que les libellés sont provisoires, NE PAS
--    lancer syncSeason sur le knockout (sinon doublons) : mettre d'abord à jour
--    les noms réels via le code `stage`.
-- Idempotent : ré-exécutable sans doublon (garde NOT EXISTS sur phase+stage).

begin;
insert into public.matches
  (competition, team_a, team_b, starts_at, channel, status, phase, stage, is_settled)
select 'Coupe du Monde 2026', '1er Groupe E', '3e A/B/C/D/F', '2026-06-29T09:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S1', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S1')
union all
select 'Coupe du Monde 2026', '1er Groupe I', '3e C/D/F/G/H', '2026-06-30T09:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S2', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S2')
union all
select 'Coupe du Monde 2026', '2e Groupe A', '2e Groupe B', '2026-06-29T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S3', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S3')
union all
select 'Coupe du Monde 2026', '1er Groupe F', '2e Groupe C', '2026-06-29T12:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S4', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S4')
union all
select 'Coupe du Monde 2026', '2e Groupe K', '2e Groupe L', '2026-07-02T09:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S5', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S5')
union all
select 'Coupe du Monde 2026', '1er Groupe H', '2e Groupe J', '2026-07-02T12:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S6', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S6')
union all
select 'Coupe du Monde 2026', '1er Groupe D', '3e B/E/F/I/J', '2026-07-01T12:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S7', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S7')
union all
select 'Coupe du Monde 2026', '1er Groupe G', '3e A/E/H/I/J', '2026-07-02T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S8', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S8')
union all
select 'Coupe du Monde 2026', '1er Groupe C', '2e Groupe F', '2026-06-30T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S9', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S9')
union all
select 'Coupe du Monde 2026', '2e Groupe E', '2e Groupe I', '2026-06-30T12:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S10', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S10')
union all
select 'Coupe du Monde 2026', '1er Groupe A', '3e C/E/F/H/I', '2026-07-01T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S11', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S11')
union all
select 'Coupe du Monde 2026', '1er Groupe L', '3e E/H/I/J/K', '2026-07-01T09:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S12', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S12')
union all
select 'Coupe du Monde 2026', '1er Groupe J', '2e Groupe H', '2026-07-03T09:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S13', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S13')
union all
select 'Coupe du Monde 2026', '2e Groupe D', '2e Groupe G', '2026-07-04T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S14', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S14')
union all
select 'Coupe du Monde 2026', '1er Groupe B', '3e E/F/G/I/J', '2026-07-03T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S15', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S15')
union all
select 'Coupe du Monde 2026', '1er Groupe K', '3e D/E/I/J/L', '2026-07-03T12:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Seizièmes', 'S16', false
where not exists (select 1 from public.matches where phase = 'Seizièmes' and stage = 'S16')
union all
select 'Coupe du Monde 2026', 'Vainqueur S1', 'Vainqueur S2', '2026-07-05T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H1', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H1')
union all
select 'Coupe du Monde 2026', 'Vainqueur S3', 'Vainqueur S4', '2026-07-05T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H2', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H2')
union all
select 'Coupe du Monde 2026', 'Vainqueur S5', 'Vainqueur S6', '2026-07-07T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H3', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H3')
union all
select 'Coupe du Monde 2026', 'Vainqueur S7', 'Vainqueur S8', '2026-07-07T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H4', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H4')
union all
select 'Coupe du Monde 2026', 'Vainqueur S9', 'Vainqueur S10', '2026-07-06T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H5', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H5')
union all
select 'Coupe du Monde 2026', 'Vainqueur S11', 'Vainqueur S12', '2026-07-06T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H6', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H6')
union all
select 'Coupe du Monde 2026', 'Vainqueur S13', 'Vainqueur S14', '2026-07-08T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H7', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H7')
union all
select 'Coupe du Monde 2026', 'Vainqueur S15', 'Vainqueur S16', '2026-07-08T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Huitièmes', 'H8', false
where not exists (select 1 from public.matches where phase = 'Huitièmes' and stage = 'H8')
union all
select 'Coupe du Monde 2026', 'Vainqueur H1', 'Vainqueur H2', '2026-07-10T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Quarts', 'Q1', false
where not exists (select 1 from public.matches where phase = 'Quarts' and stage = 'Q1')
union all
select 'Coupe du Monde 2026', 'Vainqueur H3', 'Vainqueur H4', '2026-07-10T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Quarts', 'Q2', false
where not exists (select 1 from public.matches where phase = 'Quarts' and stage = 'Q2')
union all
select 'Coupe du Monde 2026', 'Vainqueur H5', 'Vainqueur H6', '2026-07-11T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Quarts', 'Q3', false
where not exists (select 1 from public.matches where phase = 'Quarts' and stage = 'Q3')
union all
select 'Coupe du Monde 2026', 'Vainqueur H7', 'Vainqueur H8', '2026-07-11T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Quarts', 'Q4', false
where not exists (select 1 from public.matches where phase = 'Quarts' and stage = 'Q4')
union all
select 'Coupe du Monde 2026', 'Vainqueur Q1', 'Vainqueur Q2', '2026-07-15T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Demis', 'D1', false
where not exists (select 1 from public.matches where phase = 'Demis' and stage = 'D1')
union all
select 'Coupe du Monde 2026', 'Vainqueur Q3', 'Vainqueur Q4', '2026-07-16T10:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Demis', 'D2', false
where not exists (select 1 from public.matches where phase = 'Demis' and stage = 'D2')
union all
select 'Coupe du Monde 2026', 'Perdant D1', 'Perdant D2', '2026-07-19T06:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', '3ème place', 'P3', false
where not exists (select 1 from public.matches where phase = '3ème place' and stage = 'P3')
union all
select 'Coupe du Monde 2026', 'Vainqueur D1', 'Vainqueur D2', '2026-07-20T07:00:00+11'::timestamptz, 'beIN Sports', 'upcoming', 'Finale', 'F', false
where not exists (select 1 from public.matches where phase = 'Finale' and stage = 'F');
commit;
