# ADR 0005 — Moteur générique de pronostics (MarketType / Prediction / ScoringRule), MVP Champions League

Statut : **implémenté le 2026-09-25** sur CANAL Sports (`yfhuqsuboqfznnpceosl`),
migration `lot_3b_prediction_engine`. Schéma, contrats applicatifs et
scorers testés et vérifiés en conditions réelles (section 8).

**Mise à jour Lot 3D (2026-09-25)** : le HARD STOP sur le barème est levé.
Architecture B (une seule prediction `exact_score` par `(user, event)`, 1N2
dérivé) et le barème 3+2 sont actés — voir le bloc "Décisions validées
(2026-09-25, Lot 3D)" ci-dessous. `match_winner_1x2` est **supprimé** (code
+ base), plus seulement laissé dormant comme envisagé en Lot 3C. Le
settlement (`lib/scoring/settle.ts`), esquissé en pseudo-code en section 4,
est désormais du code réel, testé.

## Décisions validées (2026-09-25)

1. **`events.starts_at` courant reste l'autorité** pour autoriser/refuser
   une écriture (création/modification de `payload`). Inchangé par
   rapport à la proposition initiale.
2. **`predictions.starts_at_snapshot` est conservé comme preuve d'audit**
   du kickoff connu au moment de la **dernière** soumission acceptée —
   jamais utilisé pour rouvrir ou fermer un verrouillage. Ajustement
   apporté : il est désormais **recalculé par le trigger serveur lui-même**
   (jamais fourni par le client), et rafraîchi à chaque écriture réussie de
   `payload` (création **et** modification) — voir section 2/5.
3. **Double soumission = upsert/update, pas rejet.** Première soumission →
   `INSERT` ; nouvelle soumission avant kickoff → modification de la même
   ligne (`ON CONFLICT (user_id, event_id, market_type_id) DO UPDATE`) ;
   après kickoff → refus par le trigger. Jamais plusieurs lignes actives
   pour un même `(user, event, market)` — déjà garanti par la contrainte
   `UNIQUE`. `created_at`/`submitted_at` reste la première soumission,
   `updated_at` la dernière modification.
4. **Pas de CHECK DB par marché.** Validation stricte uniquement dans le
   registre applicatif, en mode **fail-closed** : un `market_type.code`
   sans validateur enregistré, ou un `scorer_key` sans scorer enregistré,
   fait échouer la création — jamais un passage silencieux avec un payload
   non vérifié. Voir section 3/4.
5. **Atomicité du settlement garantie par construction** : le "claim" et
   l'écriture des faits/points sont la **même** instruction `UPDATE`, pas
   deux étapes séparées — impossible qu'une prediction passe à `settled`
   sans `outcome_facts`/`points_awarded` cohérents, y compris en cas de
   crash. Détail complet en section 4.
6. **Mutabilité de `predictions` fermée au niveau colonne, pas seulement
   au niveau ligne.** Faille identifiée par l'utilisateur : le trigger
   `before insert or update of payload` protège bien `payload`, mais RLS
   ne vérifie que `user_id = ...` — rien n'empêchait auparavant un
   utilisateur propriétaire de sa ligne de modifier directement `event_id`,
   `market_type_id`, `status`, `outcome_facts`, `points_awarded`,
   `settled_at`, `submitted_at` ou `starts_at_snapshot` via un `UPDATE`
   ciblant ces colonnes plutôt que `payload`. Corrigé par un **garde-fou DB
   explicite au niveau privilège de colonne** (`REVOKE`/`GRANT` ciblés sur
   `authenticated`), qui rend ces colonnes structurellement non écrivables
   par le client, quel que soit le chemin (upsert applicatif inclus). Détail
   complet en section 2/5.

## Décisions validées (2026-09-25, Lot 3D)

Suite à l'audit d'architecture et à la simulation Monte-Carlo du Lot 3C
(`docs/lot3c-scoring-simulation.md`), confirmées explicitement par
l'utilisateur :

1. **Architecture B actée.** Une seule `prediction` de marché `exact_score`
   par `(user, event)` ; le 1N2 (`correct_outcome`) reste un fait **dérivé**
   du score par `computeExactScoreFacts()` (`lib/predictions/scorers.ts`),
   jamais une seconde prédiction saisie. Zéro changement de schéma requis —
   le code de production supportait déjà ce fonctionnement tel quel.
2. **Barème 3+2 acté** pour `exact_score` : 3 points pour le bon résultat
   1N2 (`correct_outcome`), +2 bonus (5 au total) si le score exact est
   trouvé (`exact`) ; 0 sinon. Le bonus différence de buts
   (`correct_diff`) est explicitement **rejeté** — simulation Lot 3C : écart
   de fréquence entre profils "favori" et "expert" trop faible (5,23 % vs
   5,32 %) pour être discriminant. Règle appliquée, forme JSON exacte :
   ```json
   [
     {"when": {"exact": true}, "points": 5},
     {"when": {"correct_outcome": true}, "points": 3},
     {"when": {}, "points": 0}
   ]
   ```
   Une seule ligne `scoring_rules`, `is_active=true`, rattachée
   exclusivement à `exact_score` — jamais à `match_winner_1x2`, cohérent
   avec l'architecture B où le 1N2 n'est jamais soumis séparément. Seedée
   par la migration `lot_3d_scoring_rules_bareme_3_2`.
3. **`match_winner_1x2` supprimé, pas laissé dormant.** Le Lot 3C
   envisageait de le laisser inactif au registre "sans coût" pour un besoin
   futur non spécifié (§5 point 3 du document Lot 3C). Décision Lot 3D,
   préférence explicite de l'utilisateur ("moins de concepts morts dès le
   départ") : suppression complète plutôt que rétention spéculative — audit
   de dépendances préalable (grep exhaustif + inspection live de la base
   réelle) confirmant zéro ligne `predictions`/`scoring_rules` référençant
   ce market et zéro usage applicatif en dehors du registre lui-même et de
   ses tests. Retiré de `lib/predictions/contracts.ts`,
   `lib/predictions/scorers.ts` et de `market_types` (migration
   `lot_3d_remove_match_winner_1x2`, exécutée **avant** le seed du barème du
   point 2 ci-dessus, garde explicite sur l'absence de référence dans les
   deux tables). Un test de régression confirme que `getValidator()`/
   `getScorer()` lèvent bien une erreur fail-closed pour ce code/cette clé,
   plutôt que de repasser silencieusement inaperçus.
4. **Settlement implémenté en code réel**, fidèle au pseudo-code de la
   section 4 : `lib/scoring/rules.ts` (`resolvePoints()`, pur, sans accès
   DB) et `lib/scoring/settle.ts` (`settlePendingPredictions()`,
   `settleOne()`, `voidPredictionsForCancelledEvents()`, via
   `createAdminClient()`). À ne pas confondre avec
   `services/scoring/settle.ts`, le settlement Canal Cup legacy (jokers,
   scoring par match) — produit différent, jamais réutilisé ni modifié.
5. **Trois nouvelles routes API**, toutes protégées gratuitement par
   `middleware.ts` (auth + allowlist) : `app/api/cs/predictions/route.ts`
   (`GET`/`POST`, upsert via le client serveur **authentifié** — RLS +
   `enforce_prediction_lock()` font l'application réelle du verrou par coup
   d'envoi, la route ne fait que traduire les erreurs Postgres en réponses
   HTTP propres ; `POST` est en plus protégé par `competitionLock()`
   (`lib/event/status.ts`) en tête de handler — verrou global, complémentaire
   au verrou par coup d'envoi : une compétition fermée refuse l'écriture
   même si l'event visé n'a pas encore commencé), `app/api/cs/admin/settle/
   route.ts` (`POST`, protégé par `requireCsAdmin()` — session Supabase
   réelle + allowlist admin, `lib/auth/cs-guard.ts` — **pas** un secret
   partagé : décision produit explicite pour éliminer
   `NEXT_PUBLIC_ADMIN_SECRET` du périmètre CANAL Sports ; déclenchement
   manuel uniquement dans ce lot, pas de cron ; volontairement EXEMPTÉ de
   `competitionLock()`, voir `lib/event/lock-coverage.test.ts`, car le
   settlement doit pouvoir solder les derniers events terminés même
   compétition fermée — à ne pas confondre avec `app/api/admin/settle/
   route.ts`, la route legacy Canal Cup, produit différent, toujours
   protégée par `x-admin-secret` côté legacy, inchangée),
   `app/api/cs/leaderboard/route.ts` (`GET`, classement **individuel
   uniquement** — décision explicite de l'utilisateur : "je commencerais
   par l'individuel uniquement... il vaut mieux d'abord prouver que la
   chaîne individuelle est exacte avant d'agréger" ; utilise le client admin
   pour la seule lecture agrégée, la RLS de `predictions` scope chaque
   utilisateur à ses propres lignes et empêcherait autrement toute
   agrégation cross-utilisateur).
6. **UI branchée** : `app/cs/pronostics/page.tsx` (liste des matchs
   `scheduled` à venir, saisie de score inline, désactivée côté client une
   fois `starts_at` dépassé — confort visuel uniquement, le verrou réel
   reste serveur) et `app/cs/classements/page.tsx` (classement individuel
   depuis `GET /api/cs/leaderboard`), réutilisant les primitives
   `Card`/`Section`/`Badge`/`PageShell`/`EmptyState` déjà existantes, aucun
   nouveau composant.

## 0. Rappel du cadre (non négociable, rappelé par l'utilisateur)

- Canal Cup reste strictement **read-only**, relu uniquement comme retour
  d'expérience (anti-patterns identifiés ci-dessous).
- 1N2 et score exact sont les deux **premiers** marchés d'un moteur
  générique, pas des colonnes dédiées. Un futur `pole_position` F1 doit
  s'ajouter par une ligne dans `market_types`, jamais par une migration de
  `predictions`.
- Je ne choisis pas le barème. Le scorer calcule des **faits déterministes**
  (ex: "score exact: oui/non"), un barème externe (`scoring_rules`, laissé
  vide) transforme ces faits en points. Sans barème actif, un événement
  terminé reste non soldé — jamais de points devinés.

## 1. Audit de l'existant

### 1.1 Schéma CANAL Sports actuel (vérifié en direct, projet `yfhuqsuboqfznnpceosl`)

- `sports / competitions / seasons / participants / events / event_participants`
  — Lot 1 (`supabase/migrations-canal-sports/20260925000000_referential_sport_model.sql`).
  Aucune colonne `is_settled` sur `events` (contrairement à Canal Cup
  `matches.is_settled`) — confirme que le verrouillage/settlement doit
  vivre sur `predictions`, comme demandé.
- `events.status` : check constraint exacte
  `('scheduled', 'live', 'finished', 'postponed', 'cancelled')`.
- `events.result jsonb not null default '{}'` — vérifié sur les 18 events
  déjà `finished` de la Ligue des Champions réelle : forme confirmée
  `{"home_score": n, "away_score": n}`, conforme à ADR 0001.
- `event_participants.role text` (nullable, pas de check constraint en DB,
  mais **vérifié en direct sur les 288 lignes réelles** : exactement 144
  `home` + 144 `away`, une seule paire par event, zéro ambiguïté) —
  home/away sont donc identifiables sans parsing de nom d'équipe, en
  joignant `event_participants` par `role`.
- `users(id) / organizations / memberships` — Lot 2B, en place. `predictions.user_id`
  référencera `public.users(id)` (jamais `auth.users` directement, même
  convention que `memberships`).
- Aucune table `market_types`/`predictions`/`scoring_rules` n'existe — Lot 1
  les excluait explicitement, confirmé par `list_tables` en direct (14
  tables publiques, aucune de scoring/pronostic).

### 1.2 ADR existants relus en entier

- **ADR 0001** (Sport/Competition/Season/Event) anticipait déjà quasiment
  ce lot : section "Prédictions / marchés de pronostic" propose
  `MarketType(sport_id, slug, name, payload_schema)` / `Prediction(user_id,
  event_id, market_type_id, payload, submitted_at, locked_at)` /
  `ScoringRule(market_type_id, rule jsonb)`, explicitement pour éviter "un
  pronostic = un score à deux chiffres" façon Canal Cup. Ce lot **suit et
  affine** cette proposition, ne la réinvente pas.
- **ADR 0003** (SportProvider) : les résultats structurés viennent
  uniquement de `events.result`/`event_participants`, jamais d'un adapter
  provider directement — le scorer ne doit dépendre d'aucun provider
  concret, seulement du schéma interne. Respecté (section 4).
- **ADR 0004** (organizations/memberships) : hiérarchie `parent_id`
  prête pour agréger des classements par organisation plus tard ; aucune
  table supplémentaire nécessaire pour "poser les fondations" (section 7) —
  `predictions.user_id → users → memberships → organizations` suffit pour
  un futur `GROUP BY`.

### 1.3 Canal Cup — retour d'expérience uniquement (lecture seule, non modifié)

- `lib/scoring.ts` : `PHASE_MULTIPLIERS` codé en dur (clé = libellé de
  phase FR/EN) — **anti-pattern**, jamais de constante métier liée à un
  libellé de phase. `calculatePoints()` mélange classification du résultat
  et barème dans la même fonction — **anti-pattern**, à séparer (voir
  section 4).
- `app/api/predictions/route.ts` : colonnes `predicted_score_a/b` en dur,
  une seule prédiction par match (pas de notion de marché), verrouillage
  mélangeant `status` et logique de joker (`isRedCardBlocked`,
  `hasVarWindow`) — **tout l'aspect joker est hors scope**, le
  verrouillage retenu ici est volontairement plus simple (section 5).
- `services/scoring/settle.ts` : le **seul pattern réutilisé** est la
  réclamation atomique idempotente (`UPDATE ... WHERE is_settled = false
  ... RETURNING`), transposée ici au niveau `prediction` plutôt
  qu'`event` (section 4). Tout le reste (jokers, bonus de série, génération
  IA, notifications) est explicitement laissé de côté.

## 2. Schéma SQL (appliqué le 2026-09-25, migration `lot_3b_prediction_engine`)

```sql
-- market_types : marché de pronostic, générique par sport.
create table public.market_types (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references public.sports(id) on delete restrict,
  code text not null,               -- ex: 'match_winner_1x2', 'exact_score'
  name text not null,
  payload_schema jsonb not null default '{}'::jsonb, -- documentaire, pas un validateur exécuté
  scorer_key text not null,         -- ex: 'match_winner_1x2.v1' — pointeur explicite vers l'implémentation du scorer, versionnable indépendamment de `code`
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_types_sport_code_key unique (sport_id, code)
);

-- predictions : un pronostic = un (user, event, market).
create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  market_type_id uuid not null references public.market_types(id) on delete restrict,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'settled', 'void')),
  outcome_facts jsonb,              -- calculé au settlement, null tant que pending
  points_awarded numeric,           -- null tant que pending
  settled_at timestamptz,
  starts_at_snapshot timestamptz not null, -- audit uniquement, JAMAIS l'autorité de verrouillage (voir section 5)
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint predictions_user_event_market_key unique (user_id, event_id, market_type_id)
);

create index predictions_event_id_idx on public.predictions(event_id);
create index predictions_user_id_idx on public.predictions(user_id);
create index predictions_market_type_id_idx on public.predictions(market_type_id);
create index predictions_status_idx on public.predictions(status);

-- scoring_rules : barème, table créée VIDE. Aucun point ne sera inséré
-- tant que l'utilisateur n'a pas validé de barème (HARD STOP séparé).
create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  market_type_id uuid not null references public.market_types(id) on delete restrict,
  is_active boolean not null default false,
  rule jsonb not null,               -- mapping faits -> points, forme définie par le scorer du marché
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index scoring_rules_one_active_per_market
  on public.scoring_rules(market_type_id) where is_active;

-- Triggers updated_at (réutilise public.set_updated_at(), déjà en place).
create trigger trg_market_types_updated_at before update on public.market_types
  for each row execute function public.set_updated_at();
create trigger trg_predictions_updated_at before update on public.predictions
  for each row execute function public.set_updated_at();
create trigger trg_scoring_rules_updated_at before update on public.scoring_rules
  for each row execute function public.set_updated_at();

-- Verrouillage serveur (voir section 5 pour la justification complète).
-- Recalcule aussi starts_at_snapshot ici, jamais depuis une valeur fournie
-- par le client : le snapshot d'audit doit être aussi fiable que le
-- verrouillage lui-même.
create or replace function public.enforce_prediction_lock()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ev record;
begin
  select status, starts_at into ev from public.events where id = new.event_id;
  if ev is null then
    raise exception 'unknown event %', new.event_id;
  end if;
  if ev.status <> 'scheduled' or now() >= ev.starts_at then
    raise exception 'prediction locked: event % not open (status=%, starts_at=%)',
      new.event_id, ev.status, ev.starts_at;
  end if;
  new.starts_at_snapshot := ev.starts_at;
  return new;
end;
$$;

-- "of payload" : ne se déclenche à l'UPDATE que si payload change, donc
-- jamais lors d'un settlement (qui ne touche jamais payload). Se déclenche
-- toujours à l'INSERT (la clause "of" ne filtre que l'UPDATE en Postgres).
create trigger trg_predictions_lock
before insert or update of payload on public.predictions
for each row execute function public.enforce_prediction_lock();

-- RLS
alter table public.market_types enable row level security;
alter table public.predictions enable row level security;
alter table public.scoring_rules enable row level security;

create policy "Lecture market_types" on public.market_types for select to authenticated using (true);
create policy "Lecture scoring_rules" on public.scoring_rules for select to authenticated using (true);

create policy "Lecture predictions propres" on public.predictions for select to authenticated
  using (user_id = (select id from public.users where auth_id = (select auth.uid())));
create policy "Creation predictions propres" on public.predictions for insert to authenticated
  with check (user_id = (select id from public.users where auth_id = (select auth.uid())));
create policy "Modification predictions propres" on public.predictions for update to authenticated
  using (user_id = (select id from public.users where auth_id = (select auth.uid())))
  with check (user_id = (select id from public.users where auth_id = (select auth.uid())));
-- Pas de policy delete : un pronostic n'est jamais supprimé, seulement
-- modifié (avant kickoff) ou soldé/annulé (status settled/void, écrit par
-- le rôle service, comme le reste du schéma P2).

-- Garde-fou colonne (Décision validée n°6) : RLS ne protège que les LIGNES
-- (user_id = ...), pas les COLONNES à l'intérieur d'une ligne autorisée.
-- Sans ceci, un utilisateur propriétaire de sa propre ligne pourrait
-- exécuter un UPDATE ciblant event_id/market_type_id/status/outcome_facts/
-- points_awarded/settled_at/submitted_at/starts_at_snapshot sans jamais
-- toucher `payload`, donc sans jamais déclencher trg_predictions_lock
-- (qui ne se déclenche à l'UPDATE que "of payload"). Le privilège de
-- colonne Postgres ferme cette porte à la source, indépendamment de tout
-- trigger : le rôle authenticated perd tout droit INSERT/UPDATE générique
-- sur la table, puis ne récupère explicitement que les colonnes qu'un
-- client a légitimement le droit de fournir. service_role (settlement,
-- ingestion) n'est pas concerné par ce REVOKE, donc pas impacté.
revoke insert, update on public.predictions from authenticated;
grant insert (user_id, event_id, market_type_id, payload) on public.predictions to authenticated;
grant update (payload) on public.predictions to authenticated;
-- Note : les colonnes NOT NULL non listées ici (status, starts_at_snapshot,
-- submitted_at, updated_at) ont toutes un DEFAULT ou sont assignées par un
-- trigger BEFORE (enforce_prediction_lock, set_updated_at) — les privilèges
-- de colonne ne s'appliquent qu'à la liste de colonnes explicite d'un
-- INSERT/UPDATE client, jamais aux assignations internes d'un trigger
-- BEFORE, donc l'INSERT minimal ci-dessus reste valide et le trigger
-- continue de fonctionner normalement.

-- Seed structurel (pas de barème) : les deux marchés V1, football uniquement.
insert into public.market_types (sport_id, code, name, scorer_key)
select s.id, m.code, m.name, m.scorer_key
from (values
  ('match_winner_1x2', '1N2 (domicile / nul / extérieur)', 'match_winner_1x2.v1'),
  ('exact_score', 'Score exact', 'exact_score.v1')
) as m(code, name, scorer_key)
join public.sports s on s.slug = 'football'
on conflict (sport_id, code) do nothing;
```

Décisions actées sur ce schéma (voir "Décisions validées" en tête de
document) :

1. **Pas de CHECK de validation du payload en base.** Une contrainte SQL
   par `market_type.code` recréerait le couplage par marché qu'on cherche
   justement à supprimer. Validation stricte et fail-closed uniquement
   côté applicatif (section 3/4).
2. **Deuxième prediction même (user, event, market) = upsert**, pas un
   rejet — `on conflict (user_id, event_id, market_type_id) do update`.
   Voir section 6 pour le détail des cas limites associés.

**Mise à jour Lot 3D** : le seed ci-dessus (bloc SQL, tel qu'appliqué le
2026-09-25) insérait encore `match_winner_1x2` — il a depuis été retiré par
la migration `lot_3d_remove_match_winner_1x2` (garde explicite : 0 ligne
`predictions`/`scoring_rules` référençant ce market avant suppression).
`market_types` ne contient plus qu'une ligne, `exact_score`. La ligne
`scoring_rules` du barème 3+2 a ensuite été seedée par
`lot_3d_scoring_rules_bareme_3_2` (voir bloc "Décisions validées
(2026-09-25, Lot 3D)" point 2).

## 3. Contrats des deux marchés (validation stricte côté serveur)

Aucune confiance dans le JSON envoyé par le client. Chaque marché a un
validateur explicite, tenu dans un registre applicatif (pas interprété
depuis `payload_schema`, qui reste documentaire). **Implémenté et testé**
dans `lib/predictions/contracts.ts` / `lib/predictions/contracts.test.ts`
(9 tests, tous verts — voir section 8) :

```ts
// lib/predictions/contracts.ts
type MatchWinner1x2Payload = { selection: 'home' | 'draw' | 'away' };
type ExactScorePayload = { home: number; away: number };

function validateMatchWinner1x2(raw: unknown): MatchWinner1x2Payload {
  if (typeof raw !== 'object' || raw === null) throw new InvalidPredictionPayload();
  const keys = Object.keys(raw);
  if (keys.length !== 1 || keys[0] !== 'selection') throw new InvalidPredictionPayload();
  const selection = (raw as any).selection;
  if (selection !== 'home' && selection !== 'draw' && selection !== 'away') {
    throw new InvalidPredictionPayload();
  }
  return { selection };
}

function validateExactScore(raw: unknown): ExactScorePayload {
  if (typeof raw !== 'object' || raw === null) throw new InvalidPredictionPayload();
  const keys = Object.keys(raw);
  if (keys.length !== 2 || !keys.includes('home') || !keys.includes('away')) {
    throw new InvalidPredictionPayload();
  }
  const { home, away } = raw as any;
  for (const v of [home, away]) {
    if (!Number.isInteger(v) || v < 0 || v > 20) throw new InvalidPredictionPayload();
  }
  return { home, away };
}
```

- Rejet strict des clés en trop (pas de `additionalProperties` silencieux).
- Bornes `0..20` sur le score : garde-fou anti-abus, ajustable, pas une
  règle métier.
- Le registre (`lib/predictions/registry.ts`, calqué sur
  `lib/providers/registry.ts`) dispatch par `market_types.code`, jamais un
  `switch` dupliqué dans chaque route API — un marché inconnu lève une
  erreur explicite, jamais un passage silencieux.
- **Fail-closed, explicitement** : `getValidator(code)` et `getScorer(scorerKey)`
  lèvent tous les deux une exception si l'entrée n'existe pas dans le
  registre (marché nouvellement seedé en base mais pas encore implémenté
  côté code, faute de frappe sur `scorer_key`, etc.) — jamais un payload
  accepté "par défaut" parce que la colonne est `jsonb`. Une prediction ne
  peut être créée que pour un marché dont le validateur **et** le scorer
  sont tous les deux résolus avec succès.
- Aucun `zod` actuellement en dépendance (vérifié — absent du repo) :
  validateurs manuels ci-dessus, pas de nouvelle dépendance ajoutée sans
  validation séparée. Si l'utilisateur préfère `zod`, c'est un détail
  d'implémentation substituable sans changer le contrat ni le schéma.

**Mise à jour Lot 3D** : `validateMatchWinner1x2`/`MatchWinner1x2Payload`
et l'entrée registry `match_winner_1x2` ci-dessus ont été retirés de
`lib/predictions/contracts.ts` (décision Lot 3D point 3). Seul
`validateExactScore` reste enregistré. Un test de régression confirme que
`getValidator("match_winner_1x2")` lève désormais
`UnknownMarketValidatorError` plutôt que de résoudre silencieusement un
validateur retiré.

## 4. Architecture du scorer

Séparation stricte **faits (déterministes, sans barème) → points (barème,
externe)** — c'est ce qui évite de reproduire `calculatePoints()` de Canal
Cup, qui mélangeait les deux. **Implémenté et testé** dans
`lib/predictions/scorers.ts` / `lib/predictions/scorers.test.ts` (10
tests, tous verts, y compris confirmation que `computeFacts()` s'exécute
identiquement avec `scoring_rules` à 0 ligne en base — voir section 8).
Volontairement placé sous `lib/predictions/`, jamais `lib/scoring/`, pour
ne pas se mélanger avec `lib/scoring.ts`/`lib/scoring/config.ts` (barème
Canal Cup, legacy, non touché) :

```ts
// lib/predictions/scorers.ts
interface MarketScorer<Payload> {
  code: string; // == market_types.code
  computeFacts(payload: Payload, result: EventResult): Record<string, boolean>;
}

// match_winner_1x2 : un seul fait, binaire.
const matchWinner1x2Scorer: MarketScorer<MatchWinner1x2Payload> = {
  code: 'match_winner_1x2',
  computeFacts(payload, result) {
    const actual = result.home_score === result.away_score ? 'draw'
      : result.home_score > result.away_score ? 'home' : 'away';
    return { correct: payload.selection === actual };
  },
};

// exact_score : plusieurs faits indépendants, le barème choisit lesquels
// il récompense — le scorer ne décide d'aucun point.
const exactScoreScorer: MarketScorer<ExactScorePayload> = {
  code: 'exact_score',
  computeFacts(payload, result) {
    const actualDiff = result.home_score - result.away_score;
    const predictedDiff = payload.home - payload.away;
    const actualOutcome = actualDiff === 0 ? 'draw' : actualDiff > 0 ? 'home' : 'away';
    const predictedOutcome = predictedDiff === 0 ? 'draw' : predictedDiff > 0 ? 'home' : 'away';
    return {
      exact: payload.home === result.home_score && payload.away === result.away_score,
      correct_outcome: predictedOutcome === actualOutcome,
      correct_diff: predictedDiff === actualDiff,
    };
  },
};
```

`resolvePoints(rule: ScoringRuleJson, facts: Record<string, boolean>):
number` — fonction pure, séparée, qui n'existe et n'est appelée que si une
`scoring_rules` **active** existe pour ce `market_type_id`. Forme proposée
pour `rule` (à valider avec le barème lui-même, pas figée ici) : liste de
règles ordonnées par spécificité, première correspondance gagnante, ex.
`[{"when":{"exact":true},"points":10}, {"when":{"correct_outcome":true},"points":3}, {"when":{},"points":0}]`.

**Mise à jour Lot 3D** : `matchWinner1x2Scorer` ci-dessus et l'entrée
registry `match_winner_1x2.v1` ont été retirés de
`lib/predictions/scorers.ts` (décision Lot 3D point 3) — seul
`exactScoreScorer` reste enregistré. `resolvePoints()` ci-dessus n'est
plus une proposition : implémenté tel quel dans `lib/scoring/rules.ts`
(testé, 5/5, `lib/scoring/rules.test.ts`), avec la règle 3+2 réellement
active en base (décision Lot 3D point 2) :
`[{"when":{"exact":true},"points":5}, {"when":{"correct_outcome":true},"points":3}, {"when":{},"points":0}]`
— le seuil `10` de l'exemple ci-dessus n'a jamais été retenu, uniquement
illustratif à l'époque de la rédaction initiale.

### Settlement — atomique, idempotent, auditable, provider-indépendant

Point d'attention soulevé par l'utilisateur : le "claim" (passage à
`pending → settled`) et l'écriture des faits/points ne doivent **jamais**
être deux étapes séparées — sinon un crash entre les deux laisserait une
prediction `settled` sans résultat exploitable. Correction actée : les
faits et les points sont **calculés avant** d'écrire quoi que ce soit en
base, et le passage à `settled` **est** l'écriture des faits/points — un
seul `UPDATE`, pas un claim suivi d'un update ultérieur. **Mise à jour
Lot 3D** : ce qui suit était un pseudo-code au moment de la rédaction
initiale ; c'est désormais l'implémentation réelle de
`lib/scoring/settle.ts` (testée dans `lib/scoring/settle.test.ts`,
self-skip local tant que `SUPABASE_SERVICE_ROLE_KEY` reste un placeholder —
tâche #16 — mais syntaxiquement validé et prêt à s'exécuter dès la clé
renseignée) :

```ts
// lib/scoring/settle.ts
async function settlePendingPredictions() {
  const rows = await findPendingPredictionsForFinishedEvents(); // join events.status='finished'
  for (const row of rows) {
    try {
      const rule = await getActiveScoringRule(row.market_type_id);
      if (!rule) continue; // pas de barème -> reste pending, aucun point deviné

      const scorer = getScorer(row.scorerKey); // fail-closed : throw si scorerKey inconnu
      const facts = scorer.computeFacts(row.payload, row.event.result); // pur, aucune écriture ici
      const points = resolvePoints(rule.rule, facts); // pur, aucune écriture ici

      // Seule écriture de ce cycle : status + outcome_facts + points_awarded
      // dans LA MÊME instruction UPDATE. Impossible d'obtenir settled sans
      // faits/points cohérents — soit la ligne entière passe, soit rien.
      await settleOne(row.id, facts, points);
    } catch (err) {
      logSettlementError(row.id, err); // la prediction reste 'pending', reprise au prochain passage
    }
  }
}

async function settleOne(predictionId: string, facts: Record<string, boolean>, points: number) {
  return db.query(`
    update public.predictions p
    set status = 'settled',
        outcome_facts = $2::jsonb,
        points_awarded = $3::numeric,
        settled_at = now()
    where p.id = $1
      and p.status = 'pending'
      and exists (
        select 1 from public.events e
        where e.id = p.event_id and e.status = 'finished'
      )
    returning p.id
  `, [predictionId, facts, points]);
}

async function voidPredictionsForCancelledEvents() {
  const rows = await findPendingPredictionsForCancelledEvents(); // join events.status='cancelled'
  for (const row of rows) {
    await db.query(`
      update public.predictions p
      set status = 'void', points_awarded = 0, settled_at = now()
      where p.id = $1 and p.status = 'pending'
    `, [row.id]);
  }
}
```

**Pourquoi ceci garantit qu'aucune prediction ne reste "à moitié soldée"** :

- `computeFacts`/`resolvePoints` sont des fonctions **pures**, sans accès
  base — si elles échouent (données malformées, `scorer_key` inconnu),
  rien n'a encore été écrit ; le `catch` laisse la ligne `pending` et
  journalise l'erreur pour investigation, sans bloquer les autres lignes
  du lot (isolation par ligne, pas de transaction globale qui échouerait
  entièrement à cause d'une seule prediction malformée).
- Le seul `UPDATE` qui écrit `status`/`outcome_facts`/`points_awarded` le
  fait **dans une seule instruction SQL** : Postgres l'applique
  entièrement ou pas du tout (atomicité native de l'instruction), il n'y a
  structurellement aucun état intermédiaire "settled sans facts" possible
  au niveau SQL.
- La clause `where status = 'pending' ... returning` est le mécanisme de
  réclamation lui-même (repris du seul bon pattern Canal Cup), mais
  appliqué **par prediction** plutôt que par event — un même batch relancé
  deux fois ne retouche jamais une ligne déjà `settled` (0 ligne affectée
  au deuxième passage, `points_awarded` inchangé).
- Le `exists (... e.status = 'finished')` ajouté dans le `WHERE` ferme une
  fenêtre de course résiduelle : même si `events.status` changeait entre
  la lecture initiale (`findPendingPredictionsForFinishedEvents`) et cet
  `UPDATE`, la ligne ne serait pas soldée si l'event n'est plus `finished`
  au moment exact de l'écriture.
- Un crash du process entre deux itérations de la boucle laisse les
  lignes déjà traitées correctement `settled` (facts+points cohérents) et
  les lignes restantes `pending` — reprises sans risque au prochain
  passage, aucun état partiel possible dans aucun des deux cas.
- `outcome_facts` stocké : permet de ré-auditer ou recalculer les points
  si le barème change, sans redemander le résultat au provider.
- Aucune dépendance à football-data.org ou à un provider concret : lit
  uniquement `events.result` / `event_participants.role`, conforme à ADR
  0003.
- Réutilise `public.cron_runs` (déjà en place pour l'ingestion) pour la
  traçabilité d'un futur cron de settlement (nombre de lignes soldées,
  ignorées faute de barème, en erreur) — pas de nouvelle table de log.

## 5. Stratégie de verrouillage

**Règle validée pour l'incertitude sur `starts_at`** (question posée
explicitement par l'utilisateur, ajustée après sa relecture) : deux
notions distinctes, jamais confondues.

- **Autorité d'écriture** : `events.starts_at` **courant**, relu à chaque
  tentative de création/modification. C'est lui, et lui seul, qui décide
  si l'écriture est acceptée maintenant.
- **Preuve d'audit** : `predictions.starts_at_snapshot`, qui capture le
  kickoff connu **au moment de la dernière soumission acceptée**.
  Recalculé par `enforce_prediction_lock` lui-même (jamais transmis par le
  client, jamais une valeur applicative) à chaque `INSERT` et à chaque
  `UPDATE of payload` réussi — donc toujours synchronisé avec la dernière
  écriture réellement autorisée, jamais avec une tentative refusée.

Ceci répond précisément au cas signalé par l'utilisateur : match prévu à
21h, Vincent pronostique à 20h50 (`starts_at_snapshot = 21h00`), le
provider corrige ensuite le kickoff à 20h45. Sans snapshot, la base
donnerait l'impression a posteriori qu'un pronostic a été accepté après le
coup d'envoi réel. Avec le snapshot, l'audit montre que l'écriture a été
autorisée à 20h50 contre un kickoff **alors connu** de 21h00 — la
correction ultérieure du provider n'invalide jamais rétroactivement une
écriture déjà actée. Le snapshot ne sert jamais à rouvrir ou prolonger un
verrouillage : seul `events.starts_at` courant gouverne les écritures
futures.

Conséquences directes de cette règle, données par construction :

- Si le provider **avance** `starts_at` après qu'un utilisateur a déjà
  pronostiqué, sa prédiction existante reste valide et non modifiable
  rétroactivement — elle n'est jamais invalidée après coup, seule une
  *nouvelle* tentative de modification est bloquée si le nouveau kickoff
  est déjà passé.
- Si le provider **retarde** `starts_at`, la fenêtre de modification
  s'allonge naturellement — aucune règle spéciale à écrire, le trigger
  relit toujours la valeur courante.
- Si l'event passe en `postponed`, le trigger bloque toute création/
  modification (`status <> 'scheduled'`) tant que le provider n'a pas
  republié un `status='scheduled'` avec un nouveau `starts_at` — traite le
  report comme "fermé jusqu'à nouvel ordre", pas comme "toujours ouvert
  avec une date fausse".

**Triple couche, sécurité serveur** (pas seulement UI, conforme à la
demande, renforcée par la Décision validée n°6) :

1. **Privilège de colonne DB** (`REVOKE`/`GRANT` ciblés, section 2) —
   couche la plus en amont, structurelle : le rôle `authenticated` n'a
   physiquement le droit d'`INSERT` que sur `(user_id, event_id,
   market_type_id, payload)` et d'`UPDATE` que sur `(payload)`. Toute
   tentative — directe, via `ON CONFLICT ... DO UPDATE SET`, ou via un bug
   de la couche applicative qui laisserait passer un champ protégé — est
   rejetée par Postgres avant même d'atteindre RLS ou un trigger
   (`ERROR: permission denied for column ...`). C'est le garde-fou qui
   ferme précisément la faille identifiée : RLS `WITH CHECK (user_id =
   ...)` valide la ligne, pas les colonnes à l'intérieur de cette ligne ;
   un propriétaire légitime de sa ligne ne peut donc plus détourner
   `event_id`, `market_type_id`, `status`, `outcome_facts`,
   `points_awarded`, `settled_at`, `submitted_at` ou `starts_at_snapshot`,
   quel que soit le chemin client emprunté.
2. **Trigger DB** (`enforce_prediction_lock`, section 2) — autorité du
   verrouillage temporel, non contournable même par un bug de la couche
   applicative. Ne se déclenche à l'UPDATE que si `payload` change
   (`before ... update of payload`), donc jamais lors d'un settlement.
   Complémentaire à (1), pas un substitut : (1) garantit qu'aucun autre
   champ ne peut être modifié par le client ; (2) garantit que même la
   modification de `payload`, seule colonne restée ouverte, respecte le
   kickoff.
3. **Couche applicative** (route API) — même vérification réalisée avant
   d'émettre le `INSERT`/`UPDATE`, pour renvoyer un message d'erreur propre
   (400/403) plutôt que de laisser remonter l'exception Postgres brute au
   client. L'upsert applicatif ne construit et n'envoie **que** la liste de
   colonnes `(user_id, event_id, market_type_id, payload)` à l'`INSERT`
   (`ON CONFLICT (user_id, event_id, market_type_id) DO UPDATE SET
   payload = excluded.payload`) — il ne peut donc pas contourner (1) même
   s'il essayait, puisque toute colonne hors de cette liste serait de toute
   façon rejetée par le privilège de colonne. Redondant avec (1)/(2) par
   construction, pas une alternative.

Immutabilité après settlement : un `UPDATE ... SET payload = ...` sur une
prediction déjà `status = 'settled'` ou `'void'` n'est de toute façon plus
pertinent (le trigger bloque déjà via le statut de l'event, qui est
nécessairement `finished`/`cancelled` à ce stade) — pas de règle
supplémentaire nécessaire.

## 6. Cas limites identifiés

1. **Event `finished` sans `scoring_rules` actif** — la prediction reste
   `pending` indéfiniment (aucun point deviné). Le settlement la reprendra
   automatiquement dès qu'un barème sera activé (`is_active = true`), sans
   action de rattrapage nécessaire — la requête de settlement ne filtre
   que sur `status = 'pending'` + `events.status = 'finished'`, elle ne
   dépend pas de la fraîcheur de l'event.
2. **Event `cancelled` avec des predictions `pending`** — voidées en lot
   (`status='void'`, `points_awarded=0`), même pattern de réclamation
   atomique que le settlement normal. Proposé mais à confirmer : `void`
   attribue explicitement 0, pas `null`, pour distinguer "annulé, traité"
   de "pas encore traité".
3. **Event `postponed`** — predictions existantes laissées `pending`
   (ni soldées ni voidées), nouvelles créations/modifications bloquées par
   le trigger tant que `status` n'est pas revenu à `scheduled`. Pas de
   timeout automatique en V1 si l'event reste `postponed` indéfiniment —
   acceptable, aucun point n'est en jeu tant que non `finished`.
4. **Deuxième prediction même (user, event, market) avant kickoff** —
   traitée comme une correction via `ON CONFLICT ... DO UPDATE` (upsert),
   pas comme une erreur 409 — validé par l'utilisateur, cohérent avec
   "modification avant kickoff" permise explicitement. Cette écriture
   passe par le trigger de verrouillage puisqu'elle touche `payload`, donc
   `starts_at_snapshot` est rafraîchi à cette occasion. `submitted_at`
   (équivalent du `created_at` demandé — nommé ainsi pour rester explicite
   sur ce qu'il capture) n'est jamais modifié par l'upsert, `default now()`
   ne s'applique qu'à l'`INSERT` ; `updated_at` reflète la dernière
   modification (trigger `set_updated_at`, déjà en place sur les autres
   tables).
5. **`starts_at` retardé/avancé après une prediction existante** — couvert
   section 5 : la valeur courante fait toujours foi, aucune invalidation
   rétroactive d'une prediction déjà enregistrée.
6. **Payload structurellement valide mais absurde** (ex: `home: 20, away:
   20`) — accepté (borné 0..20, section 3), aucune règle métier sur le
   réalisme d'un score ; un score 20-20 est improbable mais pas invalide au
   sens du contrat.
7. **Un marché désactivé (`market_types.is_active = false`) après coup**
   (ex: retrait temporaire du score exact) — les predictions déjà
   soumises sur ce marché restent inchangées ; la couche applicative doit
   juste refuser toute **nouvelle** création sur un marché inactif (à
   coder dans le registre applicatif, pas dans le trigger DB qui ne
   connaît que le verrouillage temporel — séparation des responsabilités).
8. **Classement par organisation (section 7 du prompt)** — aucune donnée
   ni logique supplémentaire nécessaire dans ce lot : `predictions.user_id
   → users → memberships → organizations` suffit à un futur `GROUP BY`.
   Explicitement non construit ici (pas de vue, pas de matérialisation).

## 7. Proposition de tests

Correspond point par point à la liste minimale fournie, plus les cas
limites ci-dessus :

1. Création 1N2 valide (`{"selection":"home"}`) avant kickoff → `201`,
   `status='pending'`.
2. Création score exact valide (`{"home":2,"away":1}`) avant kickoff →
   `201`, `status='pending'`.
3. Payload invalide rejeté : clé en trop, type erroné, `selection`
   hors énumération, score négatif ou > 20, score non entier → `4xx`,
   aucune ligne créée.
4. Deuxième prediction même `(user, event, market)` avant kickoff →
   upsert déterministe (même `id`, `payload` remplacé, `starts_at_snapshot`
   rafraîchi, `submitted_at` inchangé, `updated_at` avancé) — pas de
   deuxième ligne, pas d'erreur.
5. Modification avant kickoff → `payload` mis à jour, trigger laisse
   passer (`status='scheduled'`, `now() < starts_at`).
6. Création après kickoff refusée → trigger lève une exception,
   traduite en `4xx` côté API, aucune ligne créée/modifiée.
7. Modification après kickoff refusée → même trigger, `payload` inchangé
   en base après tentative.
8. Victoire domicile : `result={home:2,away:0}`, prediction
   `{"selection":"home"}` → `facts.correct=true`.
9. Nul : `result={home:1,away:1}`, prediction `{"selection":"draw"}` →
   `facts.correct=true`.
10. Victoire extérieure : `result={home:0,away:2}`, prediction
    `{"selection":"away"}` → `facts.correct=true`.
11. Score exact juste : `result={home:2,away:1}`, prediction
    `{"home":2,"away":1}` → `facts={exact:true, correct_outcome:true,
    correct_diff:true}`.
12. Score exact faux mais résultat correct : `result={home:2,away:1}`,
    prediction `{"home":3,"away":2}` → `facts={exact:false,
    correct_outcome:true, correct_diff:true}`.
13. Event non `finished` (`scheduled`/`live`/`postponed`) → jamais repris
    par `settlePendingPredictions()`, `status` reste `pending`.
14. Settlement relancé deux fois sur le même lot → deuxième passage ne
    change rien (0 ligne affectée par la deuxième réclamation, `points_awarded`
    inchangé) — pas de double crédit.
15. Event `cancelled` avec predictions `pending` → toutes passent à
    `void`, `points_awarded=0`, un seul passage suffit (idempotent comme
    (14)).
16. Event `postponed` → predictions existantes inchangées ; tentative de
    modification pendant le report refusée par le trigger.
17. (Ajout) Settlement sans `scoring_rules` actif pour le marché → la
    prediction reste `pending` après un passage de
    `settlePendingPredictions()`, aucune exception, aucune ligne modifiée.
18. (Ajout) `enforce_prediction_lock` sur un `event_id` inexistant →
    exception explicite, jamais un passage silencieux.
19. (Ajout) `scorer_key` ou validateur absent du registre applicatif pour
    un `market_type` par ailleurs actif → création refusée en amont (fail
    -closed), et si le cas se produit malgré tout côté settlement
    (régression de déploiement), la prediction concernée reste `pending`
    avec l'erreur journalisée — jamais `settled` avec des `outcome_facts`
    incomplets ou un `points_awarded` par défaut.
20. (Ajout) `computeFacts`/`resolvePoints` lève une exception pour une
    ligne du lot de settlement (donnée malformée) → cette ligne reste
    `pending` et journalisée en erreur, les autres lignes du même passage
    sont soldées normalement (isolation par ligne, pas d'échec global du
    batch).
21. (Ajout) `starts_at_snapshot` reflète bien le `events.starts_at` en
    vigueur au moment de la dernière écriture acceptée, y compris quand ce
    `starts_at` est ensuite modifié par un re-sync provider : une nouvelle
    lecture de la prediction après le re-sync doit montrer l'ancienne
    valeur figée dans `starts_at_snapshot`, différente de la nouvelle
    valeur courante dans `events.starts_at`.

## 8. Recette réelle (2026-09-25)

Migration `lot_3b_prediction_engine` appliquée sur `yfhuqsuboqfznnpceosl`.
Toutes les vérifications ci-dessous ont été exécutées en direct (MCP
Supabase), pas simulées.

### 8.1 Vérification structurelle

- **Tables** : `market_types`, `predictions`, `scoring_rules` — les trois
  présentes (`information_schema.tables`).
- **Contraintes** : PK/FK/UNIQUE/CHECK conformes au schéma section 2
  (`pg_constraint`) — notamment `predictions_user_event_market_key`
  (unique user/event/market) et `predictions_status_check`.
- **Indexes** : les 4 indexes `predictions_*_idx` + les indexes de PK/UNIQUE
  + `scoring_rules_one_active_per_market` (partiel, `where is_active`) —
  tous présents (`pg_indexes`).
- **Triggers** : les 3 `trg_*_updated_at` + `trg_predictions_lock`
  (`before insert or update of payload`) — tous présents et **activés**
  (`pg_trigger`, `tgenabled='O'`).
- **RLS** : activé sur les 3 tables (`pg_class.relrowsecurity`), 5
  policies présentes et conformes (`pg_policies`).
- **Garde-fou colonne (Décision n°6)** — vérifié avec
  `has_column_privilege('authenticated', 'public.predictions', <col>, ...)` :
  `authenticated` a `INSERT` uniquement sur `user_id`, `event_id`,
  `market_type_id`, `payload`, et `UPDATE` uniquement sur `payload`. Toutes
  les autres colonnes (`status`, `outcome_facts`, `points_awarded`,
  `settled_at`, `starts_at_snapshot`, `submitted_at`, `updated_at`, `id`)
  renvoient `false` pour `INSERT` et `UPDATE` — confirmé colonne par
  colonne, pas seulement au niveau table.
- **Advisors Supabase** (`get_advisors`, security + performance) : aucun
  nouveau finding sur `market_types`/`predictions`/`scoring_rules`. Les
  seuls findings restants (`feedback`, `inbox_events`, `users`) sont
  préexistants à ce lot, hors périmètre.

### 8.2 Données seedées

- `scoring_rules` : **0 ligne** (`select count(*)`).
- `market_types` : **exactement 2 lignes**, sport `football` —
  `match_winner_1x2` (`match_winner_1x2.v1`) et `exact_score`
  (`exact_score.v1`).

### 8.3 Tests fonctionnels réels (transaction rollback, aucune donnée persistée)

`execute_sql` s'est révélé être en lecture seule sur ce projet (`SET
default_transaction_read_only = on`), donc incapable d'exécuter la moindre
écriture, même transactionnelle. Les tests réels ont donc été exécutés via
`apply_migration` (seul chemin MCP disposant d'une connexion en écriture),
en encapsulant tout le scénario dans un `DO $$ ... $$` qui se termine par
un `RAISE EXCEPTION` portant le résumé des résultats : Postgres annule
alors **atomiquement toute la transaction** (y compris la création d'un
utilisateur `auth.users` de test et le rattachement temporaire de
`auth_id` nécessaires pour simuler `auth.uid()` sous le rôle
`authenticated`), donc aucune ligne — ni `predictions`, ni `auth.users`,
ni modification de `public.users` — n'a été conservée. Vérifié après coup
par une requête `execute_sql` séparée : `predictions` = 0 ligne, aucun
utilisateur de test dans `auth.users`, `auth_id` de l'utilisateur emprunté
revenu à `null`. La migration de test elle-même n'apparaît pas dans
`list_migrations` (son échec volontaire empêche l'écriture de la ligne de
suivi `schema_migrations`).

Résultats, exécutés sous rôle `authenticated` avec RLS actif (pas le rôle
privilégié) :

1. **INSERT valide avant kickoff** (`match_winner_1x2`, event `scheduled`
   dont `starts_at` est dans le futur) → **PASS**, ligne créée.
2. **UPDATE `payload` avant kickoff** sur cette même ligne → **PASS**,
   payload remplacé.
3. **UPDATE `status`** (tentative de détournement) → **PASS (rejeté)**,
   `permission denied` — bloqué par le garde-fou colonne, avant même RLS.
4. **UPDATE `event_id`** (tentative de détournement) → **PASS (rejeté)**,
   `permission denied`.
5. **UPDATE `points_awarded`** (tentative de détournement, invention de
   points) → **PASS (rejeté)**, `permission denied`.
6. **UPDATE `user_id`** (tentative de détournement vers un autre
   utilisateur) → **PASS (rejeté)**, `permission denied`.
7. **INSERT sur un event `finished`** (après "kickoff") → **PASS
   (rejeté)**, exception du trigger `enforce_prediction_lock` :
   `prediction locked: event ... not open (status=finished, ...)`.

Les 4 tests de détournement de colonne (3–6) confirment précisément que la
faille signalée par l'utilisateur est fermée : un propriétaire légitime de
sa ligne ne peut plus modifier `status`, `event_id`, `points_awarded` ou
`user_id`, alors même que RLS `WITH CHECK (user_id = ...)` les aurait
laissé passer sans le garde-fou colonne.

### 8.4 Tests applicatifs (`npm test`, réels, exécutés localement)

- `lib/predictions/contracts.test.ts` — **9/9 verts** : les trois
  sélections 1N2 valides, rejet clé en trop / valeur hors énumération /
  payload non-objet, score exact borné 0..20 valide, rejet clé
  manquante/en trop / score négatif / non entier / > 20 / type non
  numérique, `getValidator()` fail-closed sur un marché inconnu
  (`pole_position`).
- `lib/predictions/scorers.test.ts` — **10/10 verts** : victoire domicile/
  nul/victoire extérieure/sélection incorrecte pour `match_winner_1x2`,
  score exact/résultat correct mais score inexact/issue correcte mais
  écart différent/tout faux pour `exact_score`, `getScorer()` fail-closed
  sur un `scorer_key` inconnu, et confirmation explicite que les deux
  scorers produisent des faits sans dépendre de `scoring_rules` (0 ligne
  en base au moment du test, vérifié en direct en 8.2).
- Suite complète du repo (`node --test "lib/**/*.test.ts"`) : **72
  passed, 0 failed, 5 skipped** (skips préexistants, clés locales non
  configurées — tâche #16). Aucune régression introduite.

## Conséquences

- `predictions.starts_at_snapshot` est calculé côté serveur uniquement
  (trigger), jamais transmis par le client — même philosophie de défiance
  envers l'input client que pour `payload`.
- Le settlement ne peut structurellement jamais laisser une prediction
  `settled` sans `outcome_facts`/`points_awarded` cohérents : ces trois
  champs sont écrits dans la même instruction `UPDATE`, jamais en deux
  temps. **Mise à jour Lot 3D** : `settlePendingPredictions()` est
  désormais implémenté en code réel (`lib/scoring/settle.ts`), plus
  seulement conçu — voir section 4 et le bloc "Décisions validées
  (2026-09-25, Lot 3D)" point 4.
- Le garde-fou colonne (`REVOKE`/`GRANT`, Décision n°6) ferme la faille de
  mutabilité signalée par l'utilisateur — vérifié colonne par colonne en
  8.1 et par test de détournement réel en 8.3.
- **Mise à jour Lot 3D** : le barème (`scoring_rules.rule`) n'est plus
  vide — une ligne active existe pour `exact_score` (3+2, voir décision
  Lot 3D point 2). Le HARD STOP initial sur le barème est levé ; un
  nouveau HARD STOP s'applique désormais en fin de Lot 3D (tâche #43),
  avant toute extension (classement boutique/service, notifications,
  brief, effectifs).
- **Mise à jour Lot 3D** : une UI de pronostic minimale existe désormais
  (`app/cs/pronostics/page.tsx`, `app/cs/classements/page.tsx`) — voir
  décision Lot 3D point 6. Pas d'UI construite dans ce lot 3B initial
  (uniquement schéma + contrats + scorer + verrouillage), la phrase
  d'origine reste vraie pour le périmètre historique de ce lot.
