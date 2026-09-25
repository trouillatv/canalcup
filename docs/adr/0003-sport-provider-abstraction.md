# ADR 0003 — Abstraction des fournisseurs de données sportives (SportProvider)

Statut : **implémenté (Lot 2A) + Décision A actée le 2026-09-25**. Voir
`lib/providers/`. Le choix de fournisseur pour la Ligue des Champions
2026/27 est maintenant tranché — voir "Décision A" ci-dessous et
`docs/poc-football-providers-cl-2026-27.md` pour les faits vérifiés qui
l'ont motivé.

## Décision A — football-data.org, provider football par défaut du MVP (2026-09-25)

Sur la base du POC réel (`docs/poc-football-providers-cl-2026-27.md`),
l'utilisateur a validé explicitement :

- **football-data.org (plan Free) devient le provider football principal
  du MVP CANAL Sports.** Sélectionné via `getActiveFootballProvider()`
  (`lib/providers/registry.ts`), configurable par la variable d'env
  `FOOTBALL_PROVIDER` (défaut : `football-data.org` si absente) — le
  reste du code ne doit jamais importer un adapter concret directement,
  seulement cette fonction, pour rester sans couplage métier avec un
  fournisseur donné.
- **Périmètre données V1** (`V1_FOOTBALL_CAPABILITIES` dans
  `registry.ts`) = exactement ce qui a été vérifié AVAILABLE en conditions
  réelles : compétitions, saisons, participants/équipes, calendrier,
  statuts, scores, classement. Suffisant pour : prochains matchs, compte
  à rebours, résultats, classement CL, pronostics 1N2/score exact/
  qualifié, notifications avant match, classements collaborateurs/
  boutiques, briefs quotidiens.
- **Buteurs, cartons, compositions, statistiques détaillées sont
  explicitement HORS MVP** (confirmés UNAVAILABLE sur le plan Free
  football-data.org). Ce lot ne doit **ni les simuler, ni les scraper,
  ni souscrire une autre API pour les obtenir**. Si un vrai besoin
  produit apparaît plus tard, l'architecture `capabilities` permet
  d'ajouter un second provider ciblé sans reconstruire l'existant — ce
  n'est pas un blocage architectural, juste une décision de périmètre
  V1/V2.
- **API-Football reste un adapter disponible mais non actif** tant que
  son compte reste suspendu (constat factuel, pas une action prise sur
  le compte). Aucune fonctionnalité V1 ne dépend de lui — activable plus
  tard via `FOOTBALL_PROVIDER=api-football` sans changement de code côté
  appelant, une fois le compte réactivé et re-testé.

## Contexte (avant la Décision A)

Canal Cup est couplé en dur à un seul fournisseur : `lib/football/
api-football.ts` implémente `lib/football/provider.ts` avec des
identifiants figés (`WC_LEAGUE_ID = 1`, `WC_SEASON = 2026`) et des champs
pensés pour un seul tournoi (`channel`, `phase`). Changer de fournisseur,
ou simplement ajouter un deuxième fournisseur en complément, demanderait
de réécrire l'appelant.

CANAL Sports doit pouvoir :
- changer de fournisseur principal sans toucher au reste de l'app ;
- combiner plusieurs fournisseurs (un pour les fixtures, un autre pour des
  logos manquants, par ex.) ;
- ne jamais supposer qu'un fournisseur expose une donnée donnée — les
  plans gratuits n'ont pas tous les mêmes capacités (lineups, stats
  détaillées, standings...).

Stratégie de priorité coût donnée par l'utilisateur (aucune dépense
engagée par ce lot — `ne souscris à rien et ne déclenche aucune
dépense`) :
1. football-data.org (plan Free) — priorité n°1.
2. API-Football (plan Free) — testé en parallèle.
3. API-Football (plan Pro) — seulement si les plans Free s'avèrent
   insuffisants, et seulement après validation explicite (dépense).
4. TheSportsDB — source complémentaire optionnelle (logos/métadonnées),
   pas un remplaçant des fixtures.
5. Sportmonks — non prioritaire actuellement.

## Décision

### `SportProvider` — contrat générique (`lib/providers/sport-provider.ts`)

```
SportProvider {
  id, sport, capabilities
  getCompetitions()
  getSeasons(competitionExternalId)
  getParticipants(seasonExternalId)
  getEvents(seasonExternalId)
  getStandings?(seasonExternalId)   // optionnel, gardé par capabilities
}
```

Toutes les méthodes renvoient des DTOs qui portent `{ source,
external_id }` (`ProviderRef`) — jamais l'identité interne CANAL Sports
(`id` uuid des tables `sports/competitions/seasons/participants/events`,
voir ADR 0001). C'est délibérément la même paire que la contrainte
`UNIQUE(source, external_id)` déjà présente sur ces tables : une future
couche d'ingestion (non construite dans ce lot, hors scope) upsert ces
DTOs via `ON CONFLICT (source, external_id)`, ce qui fait de la
traduction provider→interne une conséquence naturelle du schéma plutôt
qu'une table de mapping séparée à maintenir.

### `ProviderCapabilities` — déclaration explicite, jamais déduite à l'usage

```
{ competitions, seasons, participants, fixtures, status, live, scores,
  standings, events, lineups, statistics }
```

Chaque provider déclare ses capabilities en dur dans son adapter. Le
reste du code ne doit jamais appeler une méthode optionnelle
(`getStandings`, ou les extensions foot ci-dessous) sans passer par le
garde-fou `hasCapability(provider, "standings")` exporté par
`sport-provider.ts` — ceci pour éviter le biais "on suppose que toutes
les capabilities existent" explicitement signalé par l'utilisateur.

**Distinction importante** : la capability déclarée dans le code (ex.
`footballDataOrgCapabilities`) reflète ce que la **documentation** du
fournisseur annonce. Elle n'est PAS une garantie vérifiée en conditions
réelles. Ce qui a été effectivement testé vit uniquement dans
`docs/poc-football-providers-cl-2026-27.md`, avec sa propre
classification AVAILABLE / UNAVAILABLE / NON TESTÉ / PLAN PAYANT — les
deux ne doivent jamais être confondus.

### `FootballProvider` — extension sport-spécifique (`lib/providers/football-provider.ts`)

Étend `SportProvider` avec `sport: "football"` et trois méthodes
optionnelles propres au foot : `getEventIncidents` (buts/cartons),
`getLineups` (compositions), `getStatistics` (stats de match). Même
principe : optionnelles, gardées par `capabilities`. Un futur
`F1Provider`/`RugbyProvider` suivrait le même patron sans toucher au
contrat générique.

### Adapters (`lib/providers/*.ts`)

- `football-data-org.ts` — plan Free v4, priorité 1. Capabilities
  déclarées : competitions/seasons/participants/fixtures/status/scores/
  standings à `true` (documenté), events/lineups/statistics/live à
  `false` (non documentés sur le plan Free).
- `api-football.ts` — plan Free v3, priorité 2, namespace neuf,
  **n'étend pas** `lib/football/api-football.ts` (legacy Canal Cup,
  intact, non réutilisé). Toutes les capabilities à `true` d'après la
  doc publique — à confirmer par le POC, le plan Free ayant des
  restrictions de saisons/compétitions non capturées par un simple
  booléen.
- `thesportsdb.ts` — stub structurel, priorité 4, hors scope du POC de
  cette session (non testé).
- Sportmonks — non construit, non prioritaire.

Chaque adapter lève une erreur explicite si sa clé d'API n'est pas
configurée (`process.env.X_API_KEY` absent) plutôt que d'échouer
silencieusement ou de retourner des données vides sans explication.
Aucune clé n'est committée — voir `.env.local.example` pour les
variables attendues (`FOOTBALL_DATA_ORG_API_KEY`, `API_FOOTBALL_KEY`,
`THESPORTSDB_API_KEY`, toutes optionnelles).

## Conséquences

- Le reste de CANAL Sports (couche d'ingestion à construire plus tard)
  dépend de `SportProvider`/`FootballProvider`, jamais d'un adapter
  concret — changer de fournisseur principal ou en ajouter un deuxième
  ne touche pas l'appelant.
- Aucune couche d'ingestion n'est construite dans ce lot : ces adapters
  renvoient des DTOs, ils n'écrivent rien en base. C'est un choix
  délibéré pour garder ce lot scindé du reste (organizations/users, puis
  market_types/predictions/scoring, puis l'interface Champions League).
- Le choix définitif de fournisseur(s) pour la Ligue des Champions
  2026/27 reste ouvert tant que le rapport POC n'a pas été validé par
  l'utilisateur — voir `docs/poc-football-providers-cl-2026-27.md`.
