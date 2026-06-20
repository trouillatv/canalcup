-- ============================================================================
--  migration_football_facts_matchup_v1.sql
--  Ajoute le scope 'matchup' (anecdote head-to-head entre DEUX sélections) à la
--  bibliothèque football_facts → carte « Histoire de la rencontre » du match.
--  team_slug = équipe A, team_slug_b = équipe B (lookup ordre-indépendant).
--  Idempotent.
-- ============================================================================

alter table public.football_facts add column if not exists team_slug_b text;

-- Recherche d'une confrontation par paire de slugs (dans un sens ou l'autre).
create index if not exists football_facts_matchup_idx
  on public.football_facts (team_slug, team_slug_b)
  where scope = 'matchup';
