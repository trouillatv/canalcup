-- ============================================================================
--  migration_mystery_players_v1.sql — Parcours Mystère / Canal Cup
--  Table mystery_players + seed 15 joueurs (3 niveaux).
--  Idempotent : ré-exécutable sans casse.
-- ============================================================================

create table if not exists public.mystery_players (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  difficulty  text        not null check (difficulty in ('easy', 'medium', 'hard')),
  hint_1      text        not null,
  hint_2      text,
  hint_3      text,
  hint_4      text,
  explanation text,
  is_active   boolean     not null default true,
  sort_order  int         not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.mystery_players enable row level security;

drop policy if exists "Lecture mystery_players" on public.mystery_players;
create policy "Lecture mystery_players"
  on public.mystery_players for select to authenticated using (true);

-- ── Seed 15 joueurs ──────────────────────────────────────────────────────────

insert into public.mystery_players
  (name, difficulty, hint_1, hint_2, hint_3, hint_4, explanation, sort_order)
values

-- ═══ FACILE ══════════════════════════════════════════════════════════════════

('Cristiano Ronaldo', 'easy',
 'Parcours : Sporting CP → Manchester United → Real Madrid → Juventus → Manchester United → Al Nassr',
 'Sélection : Portugal · Plus de 900 buts en carrière professionnelle',
 '5 Ballons d''Or · Recordman buts en Ligue des Champions',
 'Né à Madère (Portugal) en 1985 · Surnommé CR7',
 'Cristiano Ronaldo — l''un des deux plus grands de l''histoire.',
 10),

('Lionel Messi', 'easy',
 'Parcours : Newell''s Old Boys → FC Barcelone → PSG → Inter Miami',
 'Sélection : Argentine · Champion du Monde 2022',
 '8 Ballons d''Or · Meilleur joueur du Monde 2023',
 'Né à Rosario (Argentine) en 1987 · Surnommé La Pulga',
 'Lionel Messi — le plus grand de tous les temps pour beaucoup.',
 20),

('Kylian Mbappé', 'easy',
 'Sélection : France · Champion du Monde 2018 · Finaliste 2022',
 '8 buts en Coupe du Monde 2022 — meilleur buteur du tournoi',
 'Parcours : AS Monaco → PSG → Real Madrid',
 'Né à Bondy (France) en 1998',
 'Kylian Mbappé — star française du Real Madrid.',
 30),

('Neymar Jr', 'easy',
 'Parcours : Santos → FC Barcelone → PSG → Al Hilal',
 'Sélection : Brésil · 3 participations en Coupe du Monde',
 'Triple champion du Brésil · Vainqueur Ligue des Champions 2015',
 'Né à Mogi das Cruzes (Brésil) en 1992 · Surnommé Ney',
 'Neymar Jr — la star brésilienne au style inimitable.',
 40),

('Zinedine Zidane', 'easy',
 'Parcours : Cannes → Bordeaux → Juventus → Real Madrid',
 'Sélection : France · Champion du Monde 1998 · Champion d''Europe 2000',
 'Ballon d''Or 1998 · FIFA World Player of the Year 2000 et 2003',
 'Né à Marseille en 1972 · Entraîneur du Real Madrid (3 LDC consécutives)',
 'Zinedine Zidane — le plus grand footballeur français de l''histoire.',
 50),

-- ═══ MOYEN ═══════════════════════════════════════════════════════════════════

('Patrice Evra', 'medium',
 'Parcours : Monaco → Juventus → Manchester United → Marseille',
 'Sélection : France · Finaliste Coupe du Monde 2006',
 'Capitaine de Manchester United pendant 6 ans · 5 titres Premier League',
 'Né à Dakar (Sénégal) en 1981 · Connu pour son énergie et sa bonne humeur',
 'Patrice Evra — défenseur gauche légendaire de Manchester United.',
 60),

('Thierry Henry', 'medium',
 'Parcours : Le Havre → Monaco → Juventus → Arsenal → FC Barcelone → New York Red Bulls',
 'Sélection : France · Champion du Monde 1998 · Champion d''Europe 2000',
 'Meilleur buteur de l''histoire d''Arsenal · 51 buts en équipe de France (record)',
 'Né à Les Ulis (France) en 1977 · Légende des Gunners',
 'Thierry Henry — la légende d''Arsenal.',
 70),

('Luka Modrić', 'medium',
 'Sélection : Croatie · Finaliste Coupe du Monde 2018 · 3ème en 2022',
 'Ballon d''Or 2018 · FIFA Best Men''s Player 2018',
 'Parcours : Dinamo Zagreb → Tottenham → Real Madrid',
 'Né à Zadar (Croatie) en 1985 · 6 Ligues des Champions avec le Real',
 'Luka Modrić — le maestro croate du Real Madrid.',
 80),

('Thiago Silva', 'medium',
 'Parcours : São Paulo → Fluminense → AC Milan → PSG → Chelsea → Fluminense',
 'Sélection : Brésil · Coupe du Monde 2014 à domicile',
 'Capitaine du Brésil · Défenseur central le plus titré de l''histoire du PSG',
 'Né à Rio de Janeiro en 1984 · Surnommé "O Monstro"',
 'Thiago Silva — le patron de la défense pendant plus de 20 ans.',
 90),

('Karim Benzema', 'medium',
 'Parcours : Lyon → Real Madrid → Al Ittihad',
 'Sélection : France · Champion du Monde 2018',
 'Ballon d''Or 2022 · 4 Ligues des Champions avec le Real Madrid',
 'Né à Lyon en 1987 · Co-recordman buts du Real Madrid',
 'Karim Benzema — le Ballon d''Or 2022.',
 100),

-- ═══ DIFFICILE ════════════════════════════════════════════════════════════════

('Ronaldinho', 'hard',
 'Parcours : Grêmio → PSG → AC Milan → FC Barcelone → Flamengo → Atlético Mineiro',
 'Sélection : Brésil · Champion du Monde 2002',
 'Ballon d''Or 2005 · FIFA World Player of the Year 2004 et 2005',
 'Né à Porto Alegre (Brésil) en 1980 · Surnommé "le sorcier"',
 'Ronaldinho — le joueur le plus spectaculaire de sa génération.',
 110),

('Miroslav Klose', 'hard',
 'Sélection : Allemagne · Champion du Monde 2014',
 '16 buts en Coupe du Monde — record mondial absolu, toutes nations confondues',
 'Parcours : Kaiserslautern → Werder Brême → Bayern Munich → Lazio Rome',
 'Né en Pologne en 1978 · Naturalisé allemand · 137 sélections',
 'Miroslav Klose — le meilleur buteur de l''histoire des Coupes du Monde.',
 120),

('Claude Makélélé', 'hard',
 'Parcours : Nantes → Marseille → Celta Vigo → Deportivo La Coruña → Real Madrid → Chelsea → PSG',
 'Sélection : France · Finaliste Coupe du Monde 2006',
 'Inventeur du poste de "sentinelle" — le rôle s''appelle désormais "à la Makélélé"',
 'Né à Kinshasa (RDC) en 1973 · 71 sélections avec la France',
 'Claude Makélélé — le milieu défensif qui a révolutionné le football moderne.',
 130),

('Ángel Di María', 'hard',
 'Parcours : Rosario Central → Benfica → Real Madrid → Manchester United → PSG → Juventus',
 'Sélection : Argentine · Champion du Monde 2022 · Champion d''Amérique 2021',
 'But en finale de la Coupe du Monde 2022 · Homme du match Copa América 2021',
 'Né à Rosario (Argentine) en 1988 · Surnommé "El Fideo"',
 'Ángel Di María — le héros méconnu de toutes les finales argentines.',
 140),

('Sergio Agüero', 'hard',
 'Parcours : Independiente → Atlético Madrid → Manchester City → FC Barcelone',
 'Sélection : Argentine · 41 buts · 3 participations Coupe du Monde',
 'Recordman buts de Manchester City · But le plus célèbre de Premier League ("Agueroooo")',
 'Né à Buenos Aires en 1988 · Surnommé "Kun" · Retraite forcée pour raisons cardiaques en 2021',
 'Sergio Agüero — légende de Manchester City.',
 150)

on conflict do nothing;
