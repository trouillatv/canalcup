-- Tournoi Baby-foot CanalCup — modèle complet (édition 2026, le 16 juillet).
--
-- Remplace le "babyfoot placeholder" (matchs équipe vs équipe, 10 pts/victoire
-- dérivés) par un VRAI tournoi ÉVÉNEMENTIEL et ANNUEL : inscription par binôme,
-- disponibilités simples (matin/midi/après-midi), format au choix (élimination
-- directe OU poules+élimination), cérémonial (tirage, début, demies, finale,
-- remise des prix), photos, stats, et points TRAÇABLES par PALIER.
--
-- Décisions produit (validées) :
--   • binôme = équipe CanalCup existante (teams) : 1 user = 1 équipe → un joueur
--     ne peut pas être dans deux binômes (garanti par construction) ;
--   • barème VALEUR FACIALE, 5 paliers lisibles (participation → champion),
--     1 seul palier = le RÉSULTAT atteint (champion = 65). Registre traçable ;
--   • multi-ÉDITION : chaque année = une ligne babyfoot_tournaments (season) →
--     mémoire des champions (2026, 2027, …). On ne remplace QUE le scoring
--     10/victoire (double comptage), pas l'historique.
--
-- Idempotente (CREATE ... IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
-- RLS : lecture 'authenticated' (le classement lit ces tables via le client
-- cookie), ÉCRITURES service_role uniquement (aucune policy write → seules les
-- routes admin via createAdminClient() écrivent).

begin;

-- ── Tournoi = une ÉDITION (l'officiel + l'amical = 2 lignes via kind) ──────────
create table if not exists public.babyfoot_tournaments (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default 'Tournoi Baby-foot CanalCup',
  season            int not null default 2026,       -- édition (année) → historique
  kind              text not null default 'official' check (kind in ('official','friendly')),
  is_active         boolean not null default false,  -- l'édition qui compte au classement en cours
  event_date        date,
  -- Cérémonial : chaque statut pilote un écran TV dédié.
  status            text not null default 'draft'
                      check (status in ('draft','registration','draw','pools','knockout','finished')),
  registration_open boolean not null default false,
  target_teams      int not null default 12,         -- « plus que N équipes à inscrire »
  draw_at           timestamptz,                     -- tirage au sort (compte à rebours TV)
  kickoff_at        timestamptz,                     -- début du tournoi (compte à rebours TV)
  format            text not null default 'pools_ko' check (format in ('pools_ko','ko')),
  tables_count      int not null default 1,
  pool_target       int not null default 5,
  ko_target         int not null default 7,
  final_target      int not null default 10,
  created_at        timestamptz not null default now()
);
-- Une seule édition active à la fois (celle qui alimente le classement en cours).
create unique index if not exists uniq_bf_one_active
  on public.babyfoot_tournaments(is_active) where is_active;

-- ── Inscription d'un binôme (= une équipe) à une édition ──────────────────────
create table if not exists public.babyfoot_entries (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.babyfoot_tournaments(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  display_name  text,                       -- nom de binôme optionnel (défaut = nom d'équipe)
  registered_by uuid references public.users(id) on delete set null,
  pool_label    text,                       -- rempli à la génération (ex. 'A')
  seed          int,                        -- rang de poule (1er/2e) après les poules
  final_rank    int,                        -- classement final (1=champion, 2=finaliste, …)
  created_at    timestamptz not null default now()
);
-- Anti-doublon : une équipe ne s'inscrit qu'une fois par édition.
create unique index if not exists uniq_bf_entry_team
  on public.babyfoot_entries(tournament_id, team_id);
create index if not exists idx_bf_entry_tournament
  on public.babyfoot_entries(tournament_id);

-- ── Disponibilités : matin / midi / après-midi (matrice binôme × créneau) ─────
create table if not exists public.babyfoot_entry_availability (
  entry_id uuid not null references public.babyfoot_entries(id) on delete cascade,
  slot_key text not null,                   -- 'am' | 'noon' | 'pm' (cf. lib/config/babyfoot.ts)
  primary key (entry_id, slot_key)
);

-- ── Matchs : on ÉTEND la table babyfoot_matches existante ─────────────────────
-- (binôme = teams, donc team_a_id / team_b_id conviennent déjà tels quels).
alter table public.babyfoot_matches
  add column if not exists tournament_id uuid references public.babyfoot_tournaments(id) on delete cascade;
alter table public.babyfoot_matches
  add column if not exists phase text
    check (phase in ('pool','quarter','semi','final','third','friendly'));
alter table public.babyfoot_matches add column if not exists pool_label   text;
alter table public.babyfoot_matches add column if not exists round        text;   -- libellé lisible (le type TS l'attendait déjà)
alter table public.babyfoot_matches add column if not exists target_score int;
alter table public.babyfoot_matches add column if not exists slot_key     text;
alter table public.babyfoot_matches add column if not exists table_no     int;    -- « Table 1 / Table 2 » (TV live)
alter table public.babyfoot_matches add column if not exists order_idx    int;
-- Chaînage KO : où avance le vainqueur.
alter table public.babyfoot_matches
  add column if not exists next_match_id uuid references public.babyfoot_matches(id) on delete set null;
alter table public.babyfoot_matches add column if not exists next_slot char(1) check (next_slot in ('a','b'));
-- Les matchs générés n'ont pas toujours d'horaire fixe → starts_at devient nullable.
alter table public.babyfoot_matches alter column starts_at drop not null;
create index if not exists idx_bf_match_tournament on public.babyfoot_matches(tournament_id);

-- ── Registre des points : 1 ligne = le PALIER atteint par un binôme ───────────
-- 5 paliers lisibles. Un binôme reçoit UN palier (son résultat) ; recomputeAwards
-- réécrit l'ensemble de façon déterministe. valeur faciale (cf. config).
create table if not exists public.babyfoot_awards (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.babyfoot_tournaments(id) on delete cascade,
  entry_id      uuid not null references public.babyfoot_entries(id) on delete cascade,
  team_id       uuid not null references public.teams(id) on delete cascade,
  stage         text not null
                  check (stage in ('participation','qualified','semifinalist','finalist','champion')),
  points        int  not null,
  label         text not null,
  created_at    timestamptz not null default now()
);
-- Idempotence : un binôme a au plus UN palier par édition.
create unique index if not exists uniq_bf_award_entry
  on public.babyfoot_awards(entry_id);
create index if not exists idx_bf_award_team on public.babyfoot_awards(team_id);
create index if not exists idx_bf_award_tournament on public.babyfoot_awards(tournament_id);

-- ── Photos du tournoi (après chaque match + galerie/podium) ───────────────────
-- Modèle repris de canalcup_moments (upload via admin client + sharp→webp).
create table if not exists public.babyfoot_match_photos (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.babyfoot_tournaments(id) on delete cascade,
  match_id      uuid references public.babyfoot_matches(id) on delete set null, -- null = photo générale
  team_id       uuid references public.teams(id) on delete set null,
  user_id       uuid references public.users(id) on delete set null,
  author_name   text not null,
  photo_url     text not null,
  caption       text,
  status        text not null default 'visible' check (status in ('visible','hidden')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_bf_photo_tournament on public.babyfoot_match_photos(tournament_id, created_at desc);
create index if not exists idx_bf_photo_match on public.babyfoot_match_photos(match_id);

-- ── Journée amicale (hors points, minimal) ────────────────────────────────────
create table if not exists public.babyfoot_friendly_signups (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams(id) on delete cascade,
  user_id    uuid references public.users(id) on delete set null,
  note       text,
  created_at timestamptz not null default now()
);
create unique index if not exists uniq_bf_friendly_team
  on public.babyfoot_friendly_signups(team_id);

-- ── RLS : lecture authenticated, écritures service_role uniquement ────────────
alter table public.babyfoot_tournaments        enable row level security;
alter table public.babyfoot_entries            enable row level security;
alter table public.babyfoot_entry_availability enable row level security;
alter table public.babyfoot_awards             enable row level security;
alter table public.babyfoot_match_photos       enable row level security;
alter table public.babyfoot_friendly_signups   enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'babyfoot_tournaments','babyfoot_entries','babyfoot_entry_availability',
    'babyfoot_awards','babyfoot_match_photos','babyfoot_friendly_signups'
  ] loop
    if not exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='Lecture '||t) then
      execute format('create policy "Lecture %1$s" on public.%1$I for select to authenticated using (true)', t);
    end if;
  end loop;
end $$;

-- ── Storage : bucket public dédié aux photos baby-foot ────────────────────────
insert into storage.buckets (id, name, public)
  values ('babyfoot-photos', 'babyfoot-photos', true)
  on conflict (id) do nothing;

-- ── Seed : l'édition officielle 2026 (active), en brouillon ───────────────────
insert into public.babyfoot_tournaments (name, season, kind, is_active, event_date, target_teams, format)
select 'Baby-foot CanalCup 2026', 2026, 'official', true, date '2026-07-16', 12, 'pools_ko'
where not exists (select 1 from public.babyfoot_tournaments where kind='official' and season=2026);

commit;
