-- migration_matches_knockout_v1
-- Ajoute les 32 matchs à élimination directe (Seizièmes → Finale + 3e place) au
-- calendrier, qui ne contenait que les poules (cf. migration_matches_calendar_v1,
-- « Knockout NON inclus — à ajouter plus tard »).
--
-- Affiches = placeholders issus du tableau officiel FIFA (lib/football/
-- bracket-2026.ts) : « 1er Gr. E », « 2e Gr. A », « Meilleur 3e », « Vainqueur
-- S1 / H1 / Q1 / D1 »… Les VRAIES équipes ne sont connues qu'à la fin des poules.
--
-- ⚠️ DATES/HEURES À VÉRIFIER avant prod. Échelle = calendrier officiel WC2026
-- (heures Nouvelle-Calédonie, timestamptz +11). Les fenêtres par tour sont
-- fiables ; l'affectation jour/heure de chaque match est une projection — à
-- caler sur le calendrier officiel définitif.
--
-- GARDE : on n'insère QUE si aucun match knockout n'existe déjà (évite d'écraser
-- de vrais matchs déjà synchronisés depuis API-Football par des placeholders).
-- competition non précisé → défaut 'FIFA World Cup 2026' → visible dans /schedule.

begin;

do $$
begin
  if exists (
    select 1 from public.matches
    where phase in ('Seizièmes', 'Huitièmes', 'Quarts', 'Demis', '3ème place', 'Finale')
  ) then
    raise notice 'Des matchs knockout existent déjà — seed ignoré.';
  else
    insert into public.matches (team_a, team_b, starts_at, phase, stage) values
    -- ── Seizièmes de finale (Round of 32) ────────────────────────────────────
    ('1er Gr. E', 'Meilleur 3e', '2026-06-29 06:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. I', 'Meilleur 3e', '2026-06-29 13:00+11'::timestamptz, 'Seizièmes', null),
    ('2e Gr. A',  '2e Gr. B',    '2026-06-30 06:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. F', '2e Gr. C',    '2026-06-30 10:00+11'::timestamptz, 'Seizièmes', null),
    ('2e Gr. K',  '2e Gr. L',    '2026-06-30 14:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. H', '2e Gr. J',    '2026-07-01 06:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. D', 'Meilleur 3e', '2026-07-01 10:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. G', 'Meilleur 3e', '2026-07-01 14:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. C', '2e Gr. F',    '2026-07-02 06:00+11'::timestamptz, 'Seizièmes', null),
    ('2e Gr. E',  '2e Gr. I',    '2026-07-02 10:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. A', 'Meilleur 3e', '2026-07-02 14:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. L', 'Meilleur 3e', '2026-07-03 06:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. J', '2e Gr. H',    '2026-07-03 13:00+11'::timestamptz, 'Seizièmes', null),
    ('2e Gr. D',  '2e Gr. G',    '2026-07-04 06:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. B', 'Meilleur 3e', '2026-07-04 10:00+11'::timestamptz, 'Seizièmes', null),
    ('1er Gr. K', 'Meilleur 3e', '2026-07-04 14:00+11'::timestamptz, 'Seizièmes', null),
    -- ── Huitièmes de finale (Round of 16) ────────────────────────────────────
    ('Vainqueur S1',  'Vainqueur S2',  '2026-07-05 06:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S3',  'Vainqueur S4',  '2026-07-05 13:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S5',  'Vainqueur S6',  '2026-07-06 06:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S7',  'Vainqueur S8',  '2026-07-06 13:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S9',  'Vainqueur S10', '2026-07-07 06:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S11', 'Vainqueur S12', '2026-07-07 13:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S13', 'Vainqueur S14', '2026-07-08 06:00+11'::timestamptz, 'Huitièmes', null),
    ('Vainqueur S15', 'Vainqueur S16', '2026-07-08 13:00+11'::timestamptz, 'Huitièmes', null),
    -- ── Quarts de finale ─────────────────────────────────────────────────────
    ('Vainqueur H1', 'Vainqueur H2', '2026-07-10 06:00+11'::timestamptz, 'Quarts', null),
    ('Vainqueur H3', 'Vainqueur H4', '2026-07-10 13:00+11'::timestamptz, 'Quarts', null),
    ('Vainqueur H5', 'Vainqueur H6', '2026-07-11 13:00+11'::timestamptz, 'Quarts', null),
    ('Vainqueur H7', 'Vainqueur H8', '2026-07-12 13:00+11'::timestamptz, 'Quarts', null),
    -- ── Demi-finales ─────────────────────────────────────────────────────────
    ('Vainqueur Q1', 'Vainqueur Q2', '2026-07-15 11:00+11'::timestamptz, 'Demis', null),
    ('Vainqueur Q3', 'Vainqueur Q4', '2026-07-16 11:00+11'::timestamptz, 'Demis', null),
    -- ── Match pour la 3e place ───────────────────────────────────────────────
    ('Perdant D1', 'Perdant D2', '2026-07-19 06:00+11'::timestamptz, '3ème place', null),
    -- ── Finale ───────────────────────────────────────────────────────────────
    ('Vainqueur D1', 'Vainqueur D2', '2026-07-20 09:00+11'::timestamptz, 'Finale', null);
  end if;
end $$;

commit;
