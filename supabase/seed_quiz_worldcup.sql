-- ============================================================
-- CANAL CUP — Seed Quiz Coupe du Monde 2026
-- 36 questions factuelles vérifiées
-- Catégories : facile (10), moyen (10+5 France), difficile (10), anecdotes (1)
-- ============================================================

ALTER TABLE public.quiz_questions
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS sub_category text;

-- ─── FACILE — Coupe du Monde (10 questions) ──────────────────────────────────

INSERT INTO public.quiz_questions (question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, sub_category, explanation) VALUES

('Combien d''équipes participent à la Coupe du Monde 2026 ?',
 '32 équipes', '48 équipes', '64 équipes', '36 équipes',
 'B', 'easy', 'general', 'coupe_du_monde_facile',
 'La Coupe du Monde 2026 est la première édition à 48 équipes, contre 32 depuis 1998. Une expansion historique.'),

('Quels trois pays co-organisent la Coupe du Monde 2026 ?',
 'France, Espagne, Portugal', 'Canada, Mexique, États-Unis', 'Qatar, Arabie Saoudite, Émirats', 'Maroc, Espagne, Portugal',
 'B', 'easy', 'general', 'coupe_du_monde_facile',
 'Première fois dans l''histoire qu''un Mondial est co-organisé par trois pays. 16 villes hôtes réparties sur le continent nord-américain.'),

('Quel pays a remporté la Coupe du Monde 2022 au Qatar ?',
 'France', 'Brésil', 'Argentine', 'Maroc',
 'C', 'easy', 'general', 'coupe_du_monde_facile',
 'L''Argentine a battu la France aux tirs au but après un match de 3-3. Messi remportait enfin son premier titre mondial.'),

('Quel est le surnom officiel de l''équipe de France de football ?',
 'Les Verts', 'Les Bleus', 'Les Rouges', 'Les Tricolores',
 'B', 'easy', 'general', 'coupe_du_monde_facile',
 'Les Bleus portent le maillot bleu depuis 1904. Les Verts, c''est Saint-Étienne. Nuance importante.'),

('En quelle année a eu lieu la toute première Coupe du Monde de football ?',
 '1930', '1950', '1966', '1920',
 'A', 'easy', 'general', 'coupe_du_monde_facile',
 'La première Coupe du Monde a eu lieu en Uruguay en 1930. 13 équipes y participaient. L''Uruguay a gagné devant l''Argentine (4-2).'),

('Quel pays a remporté le plus de Coupes du Monde dans l''histoire ?',
 'Allemagne (4 titres)', 'Italie (4 titres)', 'Brésil (5 titres)', 'France (2 titres)',
 'C', 'easy', 'general', 'coupe_du_monde_facile',
 'Le Brésil est le seul pays à avoir participé à toutes les éditions du Mondial. Ses 5 titres (1958, 1962, 1970, 1994, 2002) font de lui le recordman.'),

('Quelle couleur de carton entraîne l''expulsion immédiate d''un joueur ?',
 'Jaune', 'Rouge', 'Orange', 'Vert',
 'B', 'easy', 'general', 'coupe_du_monde_facile',
 'Le carton rouge signifie l''expulsion. Inventé par l''arbitre britannique Ken Aston en 1966 pour être compréhensible sans parler la même langue.'),

('Combien de matchs seront disputés lors de la Coupe du Monde 2026 ?',
 '64 matchs (format 2022)', '104 matchs', '120 matchs', '88 matchs',
 'B', 'easy', 'general', 'coupe_du_monde_facile',
 'Avec 48 équipes en 12 groupes de 4, puis une phase à élimination directe à partir des 32es de finale, le Mondial 2026 totalisera 104 matchs.'),

('Combien de buts Kylian Mbappé a-t-il marqués lors de la Coupe du Monde 2022 ?',
 '8 buts', '6 buts', '5 buts', '10 buts',
 'A', 'easy', 'general', 'coupe_du_monde_facile',
 'Mbappé a remporté le Soulier d''or avec 8 buts, dont un triplé en finale contre l''Argentine. La France a perdu aux tirs au but malgré tout.'),

('Qui est le meilleur buteur de l''histoire de la Coupe du Monde toutes éditions confondues ?',
 'Pelé (12 buts)', 'Ronaldo Nazário (15 buts)', 'Miroslav Klose (16 buts)', 'Gerd Müller (14 buts)',
 'C', 'easy', 'general', 'coupe_du_monde_facile',
 'L''Allemand Miroslav Klose a inscrit 16 buts en quatre Coupes du Monde (2002 à 2014). Il a dépassé Ronaldo Nazário (15 buts) lors du Mondial 2014.');

-- ─── MOYEN — Coupe du Monde (10 questions) ───────────────────────────────────

INSERT INTO public.quiz_questions (question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, sub_category, explanation) VALUES

('Combien de fois la France a-t-elle remporté la Coupe du Monde ?',
 '1 fois', '2 fois', '3 fois', '0 fois',
 'B', 'medium', 'foot', 'coupe_du_monde_moyen',
 'La France a été championne du monde en 1998 (3-0 contre le Brésil) et en 2018 (4-2 contre la Croatie à Moscou).'),

('Quel pays a accueilli la Coupe du Monde 2018 ?',
 'Brésil', 'Russie', 'Qatar', 'Portugal',
 'B', 'medium', 'foot', 'coupe_du_monde_moyen',
 'La Russie a organisé la Coupe du Monde 2018. La France a battu la Croatie 4-2 en finale au stade Loujniki de Moscou.'),

('Quel joueur détient le record de buts sur une seule édition de la Coupe du Monde ?',
 'Just Fontaine (13 buts, 1958)', 'Ronaldo Nazário (8 buts, 2002)', 'Gerd Müller (10 buts, 1970)', 'Kylian Mbappé (8 buts, 2022)',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'Just Fontaine a marqué 13 buts lors du Mondial 1958 en Suède. Un record qui tient depuis 67 ans et qui semble intouchable.'),

('Quel grand pays de football n''a jamais remporté la Coupe du Monde, malgré 3 finales disputées ?',
 'Pays-Bas (1974, 1978, 2010)', 'Allemagne (4 victoires)', 'Argentine (3 victoires)', 'Portugal (jamais en finale)',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'Les Pays-Bas ont atteint la finale à trois reprises : 1974 (contre l''Allemagne), 1978 (contre l''Argentine) et 2010 (contre l''Espagne). Jamais gagné.'),

('En quelle année l''Angleterre a-t-elle remporté sa seule et unique Coupe du Monde ?',
 '1966', '1970', '1974', '1982',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'L''Angleterre a battu l''Allemagne de l''Ouest 4-2 en finale à Wembley en 1966, sur leur sol. Ils en parlent encore.'),

('Quel joueur a été élu meilleur joueur (Ballon d''Or du tournoi) de la Coupe du Monde 2022 ?',
 'Kylian Mbappé (Soulier d''Or)', 'Lionel Messi', 'Luka Modrić (MVP en 2018)', 'Emiliano Martínez (Gant d''Or)',
 'B', 'medium', 'foot', 'coupe_du_monde_moyen',
 'Messi a reçu le Ballon d''Or du tournoi pour la 2e fois (après 2014), couronné enfin champion du monde à 35 ans. Son tournoi le plus abouti.'),

('Quel pays a décroché la 3e place lors de la Coupe du Monde 2022 ?',
 'Croatie', 'Maroc', 'Angleterre', 'Portugal',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'La Croatie a battu le Maroc 2-1 dans le match pour la 3e place. Le Maroc, première équipe africaine en demi-finale de l''histoire, finissait 4e.'),

('Quel pays a créé la surprise en battant l''Argentine lors du premier match de groupe à la Coupe du Monde 2022 ?',
 'Arabie Saoudite', 'Mexique', 'Pologne', 'Cameroun',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'L''Arabie Saoudite a battu l''Argentine 2-1 le 22 novembre 2022. L''un des plus grands chocs de l''histoire du Mondial.'),

('Quel joueur français a inscrit un hat-trick en finale de la Coupe du Monde 2022 face à l''Argentine ?',
 'Antoine Griezmann', 'Kylian Mbappé', 'Olivier Giroud', 'Marcus Thuram',
 'B', 'medium', 'foot', 'coupe_du_monde_moyen',
 'Mbappé a marqué à la 80e, 81e (penalty) et 118e (penalty). La France a perdu aux tirs au but malgré ce triplé historique.'),

('Quel gardien argentin a remporté le Gant d''Or lors de la Coupe du Monde 2022 ?',
 'Emiliano Martínez', 'Thibaut Courtois', 'Hugo Lloris', 'Ederson',
 'A', 'medium', 'foot', 'coupe_du_monde_moyen',
 'Emiliano Martínez a réalisé des arrêts décisifs aux tirs au but contre les Pays-Bas et la France, contribuant directement au titre argentin.');

-- ─── DIFFICILE — Coupe du Monde (10 questions) ───────────────────────────────

INSERT INTO public.quiz_questions (question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, sub_category, explanation) VALUES

('Quel est le score de la finale France vs Brésil lors de la Coupe du Monde 1998 ?',
 '2-1', '3-0', '4-2', '2-0',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'France 3-0 Brésil : deux coups de tête de Zidane (27e, 45e) et un but de Petit (90e). Ronaldo jouait mais était diminué physiquement ce soir-là.'),

('Qui a marqué deux buts de la tête en finale de la Coupe du Monde 1998 face au Brésil ?',
 'Zinédine Zidane', 'Thierry Henry', 'Laurent Blanc', 'Emmanuel Petit',
 'A', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Zidane a inscrit deux coups de tête sur corner en première mi-temps (27e et 45e). Petit a inscrit le 3e en fin de match. Le Stade de France a explosé.'),

('Pour quelle raison les Coupes du Monde 1942 et 1946 n''ont-elles pas été organisées ?',
 'Grève des joueurs', 'Seconde Guerre mondiale', 'Trop peu de pays candidats', 'Décision de la FIFA',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Les deux éditions ont été annulées à cause de la Seconde Guerre mondiale. La compétition a repris en 1950 au Brésil, sans l''Allemagne ni le Japon.'),

('Quel pays a remporté consécutivement les Coupes du Monde 1934 et 1938 ?',
 'Uruguay (champion 1930)', 'Italie', 'Argentine', 'Allemagne',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'L''Italie, sous Vittorio Pozzo, est le seul pays à avoir réussi le doublé consécutif (1934 et 1938). Un record toujours inégalé à ce jour.'),

('Combien de buts Ronaldo Nazário a-t-il marqués au total dans les Coupes du Monde ?',
 '12 buts', '15 buts', '18 buts', '10 buts',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Ronaldo Nazário : 0 but en 1994, 4 en 1998, 8 en 2002 (record du tournoi à l''époque), 3 en 2006. Total : 15 buts, second all-time derrière Klose (16).'),

('Quel pays a accueilli la Coupe du Monde 1966 ?',
 'France', 'Angleterre', 'Espagne', 'Suède',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'L''Angleterre a organisé le Mondial 1966 sur son sol et l''a remporté face à l''Allemagne de l''Ouest (4-2). Leur seul et unique titre mondial.'),

('Quel pays a remporté la toute première Coupe du Monde en 1930 ?',
 'Uruguay', 'Italie', 'Brésil', 'Argentine',
 'A', 'hard', 'foot', 'coupe_du_monde_difficile',
 'L''Uruguay a battu l''Argentine 4-2 en finale à Montevideo devant 93 000 spectateurs. La tradition du pays hôte champion commençait bien.'),

('Quel est le score légendaire de la demi-finale Allemagne vs Brésil lors de la Coupe du Monde 2014 ?',
 '5-0', '7-1', '4-3', '6-2',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Le Mineirazo : l''Allemagne a écrasé le Brésil 7-1 à Belo Horizonte en demi-finale. 5 buts inscrits en 18 minutes (23e à 29e). Le Brésil jouait à domicile.'),

('Qui a marqué le but victorieux pour l''Argentine en finale de la Coupe du Monde 1986 contre l''Allemagne de l''Ouest (3-2) ?',
 'Diego Maradona', 'Jorge Burruchaga', 'Jorge Valdano', 'José Luis Brown',
 'B', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Burruchaga a inscrit le 3e but argentin à la 83e minute sur une passe de Maradona. Brown (23e) et Valdano (55e) avaient ouvert le score pour l''Argentine.'),

('Quel joueur est le plus jeune buteur de l''histoire de la Coupe du Monde ?',
 'Pelé (17 ans et 239 jours, 1958)', 'Kylian Mbappé', 'Michael Owen', 'Wayne Rooney',
 'A', 'hard', 'foot', 'coupe_du_monde_difficile',
 'Pelé a marqué contre le Pays de Galles à 17 ans et 239 jours lors de la Coupe du Monde 1958 en Suède. Un record qui tient depuis 67 ans.');

-- ─── FRANCE (5 questions) ────────────────────────────────────────────────────

INSERT INTO public.quiz_questions (question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, sub_category, explanation) VALUES

('Dans quelle ville française Antoine Griezmann est-il né ?',
 'Lyon', 'Mâcon', 'Dijon', 'Chalon-sur-Saône',
 'B', 'medium', 'foot', 'france',
 'Antoine Griezmann est né le 21 mars 1991 à Mâcon (Saône-et-Loire). Refusé par des clubs français pour sa petite taille, il a été formé en Espagne à la Real Sociedad.'),

('Aimé Jacquet était le sélectionneur de la France lors de quelle victoire en Coupe du Monde ?',
 '1998', '2018', '2006 (finaliste seulement)', 'Il n''a pas gagné la Coupe du Monde',
 'A', 'medium', 'foot', 'france',
 'Aimé Jacquet a entraîné les Bleus de 1994 à 1998. Très critiqué dans la presse pendant la compétition, il a quitté son poste champion du monde, en larmes lors de la cérémonie.'),

('Quel joueur français détenait le record de buts en sélection avant qu''Olivier Giroud ne le dépasse ?',
 'Thierry Henry (51 buts)', 'Michel Platini (41 buts)', 'David Trezeguet', 'Zinédine Zidane',
 'A', 'medium', 'foot', 'france',
 'Thierry Henry a terminé avec 51 buts en équipe de France. Giroud l''a dépassé lors de la Coupe du Monde 2022 et compte désormais 57 buts.'),

('Quel joueur français a marqué le 3e but de la France en finale de la Coupe du Monde 2018 contre la Croatie ?',
 'Paul Pogba', 'N''Golo Kanté', 'Olivier Giroud', 'Samuel Umtiti',
 'A', 'medium', 'foot', 'france',
 'Pogba a inscrit le 3e but à la 59e minute. Griezmann (penalty, 38e), Pogba (59e) et Mbappé (65e) ont marqué. Kanté, omniprésent, n''a pas marqué.'),

('Quel sélectionneur a mené la France à son 2e titre mondial lors de la Coupe du Monde 2018 en Russie ?',
 'Laurent Blanc', 'Didier Deschamps', 'Raymond Domenech', 'Guy Roux',
 'B', 'medium', 'foot', 'france',
 'Deschamps est l''un des rares au monde à avoir été champion du monde comme joueur (1998) ET comme entraîneur (2018), avec Zagallo et Beckenbauer.');

-- ─── ANECDOTES (1 question vérifiable) ───────────────────────────────────────

INSERT INTO public.quiz_questions (question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, sub_category, explanation) VALUES

('Quel animal est devenu célèbre pendant la Coupe du Monde 2010 pour ses prédictions de résultats, toutes correctes ?',
 'Paul le poulpe', 'Léon le pingouin', 'Bruno le lapin', 'Marcel le singe',
 'A', 'easy', 'general', 'anecdotes',
 'Paul, un poulpe vivant dans un aquarium de Oberhausen (Allemagne), a correctement prédit 8 matchs sur 8 en 2010, dont la finale Espagne-Pays-Bas. Il est décédé en octobre 2010.');
