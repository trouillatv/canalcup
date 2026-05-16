-- Canal Cup — Données de seed
-- 3 équipes fictives + matchs CdM 2026 + matinale + revivez

-- =========
-- TEAMS
-- =========
insert into public.teams (id, name, slogan, total_points, reputation_label) values
  ('11111111-0000-0000-0000-000000000001', 'Les VARcassés', 'On proteste, donc on existe', 87, 'Experts en frustration constructive'),
  ('11111111-0000-0000-0000-000000000002', 'FC Réunion Inutile', 'On y croit', 72, 'Outsiders perpétuellement confiants'),
  ('11111111-0000-0000-0000-000000000003', 'Goal Average', 'La précision avant tout (parfois)', 61, 'Philosophes du nul');

-- =========
-- MATCHES (Coupe du Monde 2026 — sélection)
-- =========
-- Note : starts_at en UTC, l'UI affiche en heure NC (+11)
insert into public.matches (id, competition, team_a, team_b, flag_a, flag_b, starts_at, channel, status, score_a, score_b, is_match_of_week) values
  ('22222222-0000-0000-0000-000000000001', 'Coupe du Monde 2026', 'France', 'Brésil', 'FR', 'BR',
   '2026-06-12 14:00:00+00', 'beIN Sports 1', 'finished', 2, 1, true),
  ('22222222-0000-0000-0000-000000000002', 'Coupe du Monde 2026', 'Allemagne', 'Espagne', 'DE', 'ES',
   '2026-06-13 17:00:00+00', 'beIN Sports 2', 'finished', 0, 0, false),
  ('22222222-0000-0000-0000-000000000003', 'Coupe du Monde 2026', 'Argentine', 'Portugal', 'AR', 'PT',
   '2026-06-14 20:00:00+00', 'Canal+ Sport', 'upcoming', null, null, false),
  ('22222222-0000-0000-0000-000000000004', 'Coupe du Monde 2026', 'Maroc', 'Sénégal', 'MA', 'SN',
   '2026-06-15 14:00:00+00', 'beIN Sports 1', 'upcoming', null, null, false),
  ('22222222-0000-0000-0000-000000000005', 'Coupe du Monde 2026', 'Japon', 'Corée du Sud', 'JP', 'KR',
   '2026-06-16 11:00:00+00', 'beIN Sports 3', 'upcoming', null, null, false);

-- ================
-- MORNING BRIEFS
-- ================
insert into public.morning_briefs (id, date, title, body, scores_summary, leaderboard_summary, fail_of_day, fun_fact, ai_comment) values
  ('33333333-0000-0000-0000-000000000001',
   '2026-06-13',
   'France 2-1 Brésil : le chaos organisé a gagné',
   'La France a battu le Brésil avec deux buts et une quantité raisonnable de VAR. Les Bleus prouvent une fois de plus que la victoire préférée des Français, c''est la victoire surprenante. Le FC Réunion Inutile avait parié sur le nul. Comme d''habitude. Les VARcassés, eux, avaient vu juste — ce qui commence à devenir inquiétant.',
   'France 2-1 Brésil • Allemagne 0-0 Espagne',
   '1. Les VARcassés (87pts) • 2. FC Réunion Inutile (72pts) • 3. Goal Average (61pts)',
   'Le FC Réunion Inutile a parié sur un nul 1-1. Le football leur a répondu 2-1. C''est proche. Dans un univers parallèle.',
   'Saviez-vous que Canal+ a diffusé son premier match en direct en 1984 ? Soit l''année où les télécommandes existaient déjà, contrairement aux VAR.',
   'Continue comme ça, les VARcassés. Une régularité dans les bons résultats, c''est aussi une forme de talent.');

-- ==============
-- REVIVEZ POSTS
-- ==============
insert into public.revivez_posts (id, type, title, content, team_id, votes_count) values
  ('44444444-0000-0000-0000-000000000001', 'phrase', 'La citation de la semaine',
   '"On avait le bon résultat. Le football, lui, avait une autre idée." — FC Réunion Inutile, après France-Brésil',
   '11111111-0000-0000-0000-000000000002', 23),
  ('44444444-0000-0000-0000-000000000002', 'fail', 'Le pronostic du siècle',
   'Goal Average a pronostiqué Allemagne 4-0 Espagne. Le match s''est terminé 0-0. La confiance était là. La précision, moins.',
   '11111111-0000-0000-0000-000000000003', 41),
  ('44444444-0000-0000-0000-000000000003', 'roast', 'Le coach IA a parlé',
   'Le coach des VARcassés : "Ils gagnent trop. C''est suspect. Je les surveille."',
   '11111111-0000-0000-0000-000000000001', 17),
  ('44444444-0000-0000-0000-000000000004', 'babyfoot', 'Babyfoot : la finale qui a tout déchiré',
   'VARcassés vs FC Réunion Inutile : 5-3 après prolongations fictives. Le babyfoot ne connaît pas le nul.',
   null, 31),
  ('44444444-0000-0000-0000-000000000005', 'phrase', 'Philosophie de tournoi',
   '"Participer c''est gagner." — FC Réunion Inutile (ils participent beaucoup)',
   '11111111-0000-0000-0000-000000000002', 55);

-- ================
-- BABYFOOT MATCHES
-- ================
insert into public.babyfoot_matches (id, team_a_id, team_b_id, starts_at, score_a, score_b, status, highlight) values
  ('55555555-0000-0000-0000-000000000001',
   '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002',
   '2026-06-12 12:00:00+00', 5, 3, 'finished',
   'Les VARcassés ont contesté 3 buts. Tous valides.'),
  ('55555555-0000-0000-0000-000000000002',
   '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003',
   '2026-06-13 12:00:00+00', 2, 4, 'finished',
   'Goal Average a vécu à la hauteur de son nom.'),
  ('55555555-0000-0000-0000-000000000003',
   '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000003',
   '2026-06-16 12:00:00+00', null, null, 'upcoming',
   null);

-- =================
-- QUIZ QUESTIONS
-- =================
insert into public.quiz_questions (id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category) values
  ('66666666-0000-0000-0000-000000000001',
   'En quelle année Canal+ a-t-il diffusé son premier match de football ?',
   '1980', '1984', '1987', '1992',
   'B', 'easy', 'canal'),
  ('66666666-0000-0000-0000-000000000002',
   'Combien de pays accueillent la Coupe du Monde 2026 ?',
   '1', '2', '3', '4',
   'C', 'easy', 'foot'),
  ('66666666-0000-0000-0000-000000000003',
   'Quel pays a remporté le plus de Coupes du Monde ?',
   'Allemagne', 'France', 'Brésil', 'Argentine',
   'C', 'medium', 'foot'),
  ('66666666-0000-0000-0000-000000000004',
   'Quelle est la durée réglementaire d''un match de football ?',
   '80 minutes', '90 minutes', '100 minutes', '120 minutes',
   'B', 'easy', 'general'),
  ('66666666-0000-0000-0000-000000000005',
   'Que signifie VAR dans le football ?',
   'Video Assistant Referee', 'Very Aggressive Referee', 'Virtual Analysis Review', 'Video Action Replay',
   'A', 'easy', 'foot');
