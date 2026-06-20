-- ============================================================================
--  migration_football_facts_v1.sql
--  Bibliothèque d'anecdotes football pré-générées pour le « Le Saviez-vous ? »
--  du centre du match. Principe Canal Cup : aucune génération IA à l'affichage
--  (coût ~0, stable, fiable). On lit des faits STOCKÉS + des faits dérivés des
--  données en base (effectifs, forme, pronostics).
--
--  Gate de validation : seul status='approved' est servi. La génération IA
--  one-shot écrit en 'pending' → revue → approbation.
--  Idempotent — peut être relancé sans danger.
-- ============================================================================

create table if not exists public.football_facts (
  id uuid primary key default uuid_generate_v4(),
  scope text not null,                 -- 'team' | 'worldcup' | 'general'
  team_slug text,                      -- slug wc-team (scope='team'), sinon null
  theme text not null,                 -- 'histoire'|'records'|'participation'|'joueur'|'equipe'|...
  content text not null,
  priority int not null default 0,     -- tri (plus haut = prioritaire)
  source text,                         -- 'curated' | 'ai-gemini-YYYY-MM' | ...
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists football_facts_lookup_idx
  on public.football_facts (status, scope, team_slug);

alter table public.football_facts enable row level security;

-- Lecture publique des faits approuvés (comme les autres données de lecture).
drop policy if exists "Lecture football_facts" on public.football_facts;
create policy "Lecture football_facts" on public.football_facts
  for select to authenticated using (status = 'approved');
