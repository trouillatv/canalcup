-- ═══════════════════════════════════════════════════════════════════════════
--  Provenance des données — v1
--  Regroupe deux besoins nés du nettoyage de la CdM 2026 (20/07/2026).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. matches.data_origin ──────────────────────────────────────────────────
-- Sépare explicitement données réelles / reconstruites / simulations / tests.
-- Motif : des matchs de test (PSG-Arsenal, Rayo-Palace…) cohabitent avec les
-- vrais matchs et polluent statistiques, recherches et affichages publics. On
-- ne les supprime pas — ils garderaient leur contexte et des références y
-- pointent — on les marque pour pouvoir les exclure par doctrine.
alter table public.matches
  add column if not exists data_origin text not null default 'official_api'
  check (data_origin in ('official_api', 'reconstructed', 'simulation', 'test'));

comment on column public.matches.data_origin is
  'Provenance : official_api (fournisseur), reconstructed (saisi depuis une '
  'capture/source externe validée), simulation, test. Les lectures produit '
  '(classements, stats, recherches) ne doivent servir que official_api et '
  'reconstructed.';

-- ── 2. player_aliases ───────────────────────────────────────────────────────
-- Un même joueur porte plusieurs orthographes selon la source : « N. Pépé »
-- côté API-Football, « Nicolas Pépé » côté Transfermarkt, « M. Cucurella »
-- côté Sofascore. Utiliser le nom comme clé métier fait perdre des lignes en
-- silence lors des agrégations.
--
-- Cette table découple l'import de la résolution d'identité : on importe
-- aujourd'hui avec l'alias tel qu'affiché par la source, et on rattache plus
-- tard au joueur canonique sans réimporter quoi que ce soit.
--
-- canonical_player_id est NULLABLE et volontairement non contraint par une FK :
-- il porte l'identifiant API-Football (texte, cf. player_match_stats.player_id)
-- qui n'est pas connu au moment de l'import.
-- Clé d'unicité : (provider, alias) — PAS (provider, alias, match_id).
-- La correspondance « M. Cucurella → joueur 2853 » est vraie indépendamment du
-- match. Y ajouter match_id créerait une ligne par match, obligerait à
-- revalider le même joueur autant de fois qu'il apparaît, et un rattachement
-- validé ne profiterait pas aux imports suivants — l'inverse du but recherché.
-- On garde donc UNE ligne par alias, et on trace la PREMIÈRE observation
-- (match + capture) à titre de provenance.
create table if not exists public.player_aliases (
  id uuid primary key default uuid_generate_v4(),
  provider text not null check (provider in ('sofascore', 'api-football', 'transfermarkt', 'tsdb', 'manual')),
  alias text not null,
  canonical_player_id text,
  canonical_name text,
  confidence numeric(3, 2) not null default 1.0 check (confidence >= 0 and confidence <= 1),
  -- Provenance de la première observation de cet alias.
  first_seen_match_id uuid references public.matches(id) on delete set null,
  source_image text,
  occurrences int not null default 1,
  validated_at timestamptz,
  validated_by text,
  created_at timestamptz not null default now(),
  unique (provider, alias)
);

comment on table public.player_aliases is
  'Correspondance alias fournisseur → joueur canonique. Permet d''importer '
  'sans identifiant puis de rattacher a posteriori. Ne jamais utiliser le nom '
  'de joueur comme clé métier.';
comment on column public.player_aliases.canonical_player_id is
  'Identifiant API-Football (texte), aligné sur player_match_stats.player_id. '
  'NULL tant que le rattachement n''a pas été fait ou validé.';
comment on column public.player_aliases.confidence is
  'Fiabilité du rattachement, 0 à 1. 1.0 = validé humainement.';

create index if not exists player_aliases_canonical_idx
  on public.player_aliases (canonical_player_id)
  where canonical_player_id is not null;

-- Les alias non encore rattachés : c'est la file de travail du rattachement.
create index if not exists player_aliases_unresolved_idx
  on public.player_aliases (provider, alias)
  where canonical_player_id is null;
