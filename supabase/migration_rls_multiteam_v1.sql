-- migration_rls_multiteam_v1
-- Hardening RLS minimal sur les 3 tables créées par les pivots
-- récents (équipes multi-team + animations groupes). Toutes étaient
-- RLS=DISABLED + 0 policies → tout user (et même anonymous) pouvait
-- lire/écrire arbitrairement via le client Supabase, contournant nos
-- endpoints API.
--
-- Stratégie :
--   - RLS ENABLED partout.
--   - SELECT : autorisé aux users AUTHENTIFIÉS (auth.uid() not null).
--     Bloque le scraping anonyme. Garde les flows actuels qui lisent
--     ces tables via supabase server client (cookies-based) — ils
--     ont une session valide.
--   - INSERT / UPDATE / DELETE : AUCUNE policy → refusés par défaut.
--     Toute écriture doit passer par les endpoints API qui utilisent
--     le service-role (createAdminClient) — bypass RLS volontaire et
--     contrôlé côté serveur.
--
-- Trade-off accepté pour le contexte RSE bureau (~30 users, confiance) :
-- un user authentifié peut READ toutes les memberships/demandes/
-- participations de ses collègues. Pour la v2 publique (plus tard),
-- on tightenera (own-rows-only ou via sous-requêtes), mais ces tables
-- restent dans le schéma interne, le public utilise public_* séparées
-- (cf. docs/PUBLIC_VERSION_ARCHITECTURE.md).
--
-- Idempotent.

begin;

-- ── team_memberships ─────────────────────────────────────────────────────────
alter table public.team_memberships enable row level security;

drop policy if exists "Lecture team_memberships (authent.)" on public.team_memberships;
create policy "Lecture team_memberships (authent.)"
  on public.team_memberships for select
  using (auth.uid() is not null);

-- ── team_join_requests ───────────────────────────────────────────────────────
alter table public.team_join_requests enable row level security;

drop policy if exists "Lecture team_join_requests (authent.)" on public.team_join_requests;
create policy "Lecture team_join_requests (authent.)"
  on public.team_join_requests for select
  using (auth.uid() is not null);

-- ── challenge_entry_participants ─────────────────────────────────────────────
alter table public.challenge_entry_participants enable row level security;

drop policy if exists "Lecture challenge_entry_participants (authent.)" on public.challenge_entry_participants;
create policy "Lecture challenge_entry_participants (authent.)"
  on public.challenge_entry_participants for select
  using (auth.uid() is not null);

commit;
