# ADR 0004 — Organizations / memberships / adaptation de users (Lot 2B structurel)

Statut : **implémenté le 2026-09-25** sur CANAL Sports (`yfhuqsuboqfznnpceosl`),
migrations `lot_2b_organizations_memberships` puis `lot_2b_perf_fixes`.
Schéma vide au moment de l'application (0 ligne `users`) — pas de
migration de données dans ce lot, seulement de structure. Voir ADR 0001
pour le socle Sport/Competition/Season/Event, indépendant de ce lot.

## Contexte

`public.users` existait déjà (créé avant ce lot) avec un `service_id uuid`
sans FK, sans table `services`/`organizations` en face, et sans notion de
rôle. Ce lot devait :
- remplacer `service_id` par un vrai modèle d'appartenance
  organisationnelle, source de vérité unique ;
- couvrir au minimum les deux types connus (service interne, boutique),
  sans s'y enfermer — l'idée produit sous-jacente (classement individuel →
  boutique → service → zone/réseau → global) implique une hiérarchie, pas
  seulement une appartenance plate ;
- permettre l'appartenance multiple (un utilisateur peut appartenir à
  plusieurs organisations) avec une organisation principale ;
- rester simple : pas de modèle d'administration globale de l'application
  dans ce lot, pas de typologie d'organisation sur-construite.

## Décision

### `organizations`

```sql
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('service', 'store', 'group')),
  parent_id uuid references public.organizations(id) on delete restrict,
  name text not null,
  slug text not null unique,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_parent_not_self check (parent_id is null or parent_id <> id)
);
```

- **`type`** : `service | store | group`, via `CHECK` (pas de table de
  typologie séparée — la liste est encore petite et stable ; heuristique
  ADR 0001 "JSONB/table dédiée seulement si la donnée est interrogée
  finement ou volumineuse", qui ne s'applique pas ici). Étendre la liste
  reste une migration `DROP CONSTRAINT` / `ADD CONSTRAINT`, pas une
  réécriture de schéma.
- **`parent_id`** (auto-référence, `ON DELETE RESTRICT`) : prépare la
  hiérarchie vendeur → boutique → zone/réseau → global sans l'imposer —
  une organisation sans parent reste valide. `RESTRICT` plutôt que
  `CASCADE`/`SET NULL` : supprimer une organisation qui a des enfants doit
  être un geste explicite (réassigner les enfants d'abord), pas un moyen
  de casser silencieusement une hiérarchie. `CHECK (parent_id <> id)`
  bloque l'auto-référence directe. **Non couvert** : les cycles indirects
  (A parent de B parent de A) — nécessiteraient un trigger récursif, pas
  construit dans ce lot faute de besoin démontré.
- **`metadata jsonb default '{}'`** : seule soupape pour des attributs
  organisationnels pas encore stabilisés (ex: adresse d'une boutique).
  Rien ne la lit/l'écrit à ce stade.
- RLS activé, une seule policy `SELECT` (`(select auth.uid()) is not
  null` — lecture réservée aux utilisateurs authentifiés, pas de
  `USING (true)` public comme sur `sports`/`competitions`, car aucune page
  anonyme n'en a besoin). Aucune policy d'écriture : les mutations passent
  par le rôle service (backend), même convention que le reste du schéma
  P2.

### `memberships`

```sql
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'manager')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, organization_id)
);

create unique index memberships_one_primary_per_user
  on public.memberships (user_id) where is_primary;
```

- Appartenance multiple : `UNIQUE (user_id, organization_id)` empêche un
  doublon de membership pour la même paire, sans limiter le nombre
  d'organisations différentes par utilisateur.
- Organisation principale : `is_primary boolean`, garantie unique par
  utilisateur via un **index unique partiel** (`WHERE is_primary`) —
  mécanisme Postgres natif, pas de trigger applicatif nécessaire pour
  cette contrainte.
- **`role` = `member | manager` uniquement.** Décision explicite : le rôle
  *dans* une organisation (ex: gérant de boutique) est distinct de
  l'administration *globale* de CANAL Sports (ex: un admin plateforme ne
  devient pas automatiquement "admin" de chaque organisation à laquelle il
  appartient). Pas de valeur `admin` dans `memberships.role` — un modèle
  d'administration globale reste à concevoir séparément, hors de ce lot.
- RLS activé, une seule policy `SELECT` limitée aux memberships de
  l'utilisateur courant (`user_id in (select id from users where auth_id =
  (select auth.uid()))`). Aucune policy d'écriture — mêmes raisons que
  `organizations`.

### `users`

`service_id` supprimé (`ALTER TABLE users DROP COLUMN service_id`) — la
table était vide (0 ligne) au moment de la migration, donc pas de perte de
données ; `memberships` devient l'unique source de vérité pour
l'appartenance organisationnelle. `auth_id` (FK vers `auth.users`,
préexistante) n'est pas touché — ce lot ne modifie rien côté identité/auth
et reste indépendant du futur import des identités Canal Cup (voir tâche
dry-run à suivre).

### Corrections de performance appliquées immédiatement

`get_advisors` (Supabase) a signalé, sur les tables neuves uniquement :
- `memberships.organization_id` sans index couvrant sa FK (contrairement
  à `user_id`, couvert par l'index unique composite) → `CREATE INDEX
  memberships_organization_id_idx`.
- Les deux nouvelles policies RLS ré-évaluaient `auth.uid()` par ligne
  plutôt qu'une fois par requête → réécrites avec `(select auth.uid())`,
  pattern Supabase standard (`auth_rls_initplan`).

Ces deux corrections ont été appliquées dans une deuxième migration
(`lot_2b_perf_fixes`) pendant que les tables étaient encore vides — coût
nul, évite d'introduire une dette dès la création. Les autres findings de
`get_advisors` (sur `feedback`, `inbox_events`, `users` existants) sont
préexistants à ce lot et hors scope.

## Alternatives rejetées

- **`admin` comme valeur de `memberships.role`** — rejeté : mélangerait
  rôle organisationnel et administration globale de l'application sans
  besoin fonctionnel démontré. Un utilisateur admin plateforme n'est pas
  nécessairement "admin" de chaque organisation à laquelle il appartient.
- **Typologie d'organisation en table dédiée (`organization_types`)** —
  rejeté pour ce lot : la liste (`service`/`store`/`group`) est encore
  petite et stable ; une `CHECK` suffit et reste extensible par migration
  simple. Réévaluable si la typologie devient elle-même une donnée
  interrogée (icônes, règles métier par type, etc.).
- **`organizations.type` fermé à `service`/`store`** (proposition
  initiale) — rejeté par l'utilisateur : n'aurait pas couvert le
  regroupement zone/réseau nécessaire à la hiérarchie boutique → zone →
  global, remplacé par `service | store | group` + `parent_id`.

## Conséquences

- Le modèle organisationnel n'est plus couplé à un seul service par
  utilisateur (`service_id`) — un utilisateur peut appartenir à plusieurs
  organisations, avec une organisation principale identifiable sans
  ambiguïté (`is_primary`, garanti unique par contrainte, pas par
  convention applicative).
- La hiérarchie `parent_id` est prête pour les classements agrégés
  (vendeur → boutique → zone/réseau → global) mais aucun code ne
  l'exploite encore dans ce lot — pure préparation de structure.
- L'administration globale de CANAL Sports reste un sujet non modélisé —
  ne pas supposer qu'un rôle `manager` de `memberships` équivaut à un
  accès admin applicatif.
- Prochaine étape : dry-run du mapping Canal Cup → CANAL Sports (10
  services + 49 collaborateurs, lecture seule sur Canal Cup, aucun
  auth_id/mot de passe/identité Auth migré) — HARD STOP avant toute
  écriture réelle de données collaborateurs.
