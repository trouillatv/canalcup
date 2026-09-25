# Architecture Supabase — séparation CANAL Sports / Canal Cup (P2)

Statut : **décidé et vérifié**. Remplace la section "Ce qui reste à faire"
de `docs/supabase-bootstrap-strategy.md` (P1) — ce document ne portait que
sur les tables à recréer, pas sur la question "combien de bases Supabase ?"
qui restait ouverte à l'époque.

## Décision

Deux projets Supabase distincts, jamais un seul :

| | Canal Cup (legacy) | CANAL Sports (principal) |
|---|---|---|
| Project ref | `qmkbnafilhdhnsdupgzd` | `yfhuqsuboqfznnpceosl` |
| Organisation | (compte Supabase existant, hors scope du connecteur MCP) | `vjasdstjdszsekbwazbi` ("trouillat V", plan Pro) |
| Accès | **LECTURE SEULE** | **LECTURE + ÉCRITURE** |
| Rôle | Source historique (WC2026, babyfoot, quiz, jokers, comptes) | Seule base métier de CANAL Sports à partir de P2 |
| Migrations | Aucune nouvelle — figée | `supabase/migrations-canal-sports/` (nouveau dossier, ne réutilise pas `supabase/migrations/` qui reste l'historique Canal Cup) |

Pas de clone, pas de branche Supabase à partir de la base Canal Cup : les
branches Supabase sont un environnement isolé d'un même projet/schéma, pas
un mécanisme pour démarrer un produit neuf à partir d'un schéma chargé de
dette (65 migrations, tables babyfoot/quiz/jokers, hacks WC2026).

## Pourquoi un projet différent de celui créé précédemment

Un projet `canal-sports` (`xwmgmewebqbicghhrvfs`) avait été créé plus tôt
dans une organisation liée à l'intégration Vercel Marketplace
(`vercel_icfg_iLkIlXMGCs1MtbcnMRkdFwhq`), avant que l'organisation cible
définitive (`vjasdstjdszsekbwazbi`) soit précisée. Conservé tel quel, non
utilisé — voir "État" ci-dessous.

## Garde-fous techniques (pas seulement une convention)

1. **`lib/supabase/legacy.ts`** — `createLegacyReadOnlyClient()` :
   - refuse de s'instancier si `LEGACY_CANALCUP_SUPABASE_URL` et
     `NEXT_PUBLIC_SUPABASE_URL` pointent vers le même project ref ;
   - bloque `insert`/`update`/`upsert`/`delete`/`rpc`/`storage` au niveau
     du client (via `Proxy`), même si la clé fournie est une service-role
     key qui aurait techniquement les droits d'écriture.
2. **`instrumentation.ts`** — au démarrage du process Next.js (Node.js
   runtime), appelle `assertDistinctSupabaseProjects()` : le serveur ne
   démarre pas si les deux URLs Supabase sont identiques.
3. **Connecteur Supabase MCP scopé** — le connecteur utilisé pour toutes
   les opérations d'écriture (migrations, `execute_sql` d'écriture réel
   via `apply_migration`) n'a accès qu'à l'organisation
   `vjasdstjdszsekbwazbi`. Il ne peut techniquement pas cibler
   `qmkbnafilhdhnsdupgzd` (hors scope, `get_project` renvoie une erreur de
   permission) — aucune migration ne peut donc être appliquée par erreur
   sur Canal Cup par ce chemin.
4. **Variables d'environnement sans ambiguïté** — `NEXT_PUBLIC_SUPABASE_*`
   / `SUPABASE_SERVICE_ROLE_KEY` désignent uniquement CANAL Sports ;
   `LEGACY_CANALCUP_SUPABASE_*` désigne uniquement Canal Cup. Aucune
   fonction générique ne peut confondre les deux (`createAdminClient()` et
   `createLegacyReadOnlyClient()` lisent des variables différentes).
5. **Convention scripts** — les futurs scripts d'audit/import doivent
   vivre sous un dossier dédié (ex. `scripts/legacy-audit/`) et n'importer
   que `lib/supabase/legacy.ts` pour la lecture Canal Cup ; toute écriture
   qu'ils produisent va vers `lib/supabase/admin.ts` (CANAL Sports). Aucune
   route applicative (`app/**`) ne doit importer `lib/supabase/legacy.ts`.

## Limite connue : garde-fou applicatif ≠ garantie base de données

Le point 1 ci-dessus (`Proxy` dans `lib/supabase/legacy.ts`) est une bonne
**défense applicative** : il empêche le code CANAL Sports d'appeler
`insert`/`update`/`upsert`/`delete`/`rpc`/`storage` sur le client Canal Cup,
quel que soit le développeur qui écrit le script. Mais ce n'est **pas une
garantie côté base de données**. Si la clé fournie (`LEGACY_CANALCUP_SUPABASE_SERVICE_ROLE_KEY`)
a réellement les droits d'écriture au niveau Postgres :

- un appel qui contourne le `Proxy` (accès direct à `target` via
  `Object.getPrototypeOf`, un `fetch` REST manuel vers l'API Supabase avec
  la même clé, un futur script qui oublie d'utiliser `createLegacyReadOnlyClient()`
  et instancie `createClient()` directement avec la clé legacy) écrirait
  réellement dans Canal Cup ;
- rien côté Postgres/PostgREST ne le bloquerait, car le `service_role` key
  bypasse RLS par construction (c'est fait pour).

Autrement dit : le `Proxy` protège contre les erreurs de code involontaires
dans CANAL Sports, pas contre une clé mal utilisée ou une écriture faite en
dehors de ce module. C'est une défense en profondeur utile, pas la garantie
principale.

### Proposition (non exécutée) — rôle Postgres réellement lecture seule

Objectif : que Canal Cup refuse une écriture **au niveau du moteur
Postgres**, indépendamment de tout code applicatif. Deux façons d'y arriver,
classées de la plus propre à la plus simple :

**Option A — rôle Postgres dédié + JWT signé avec ce rôle (recommandée)**

```sql
-- À exécuter côté Canal Cup (qmkbnafilhdhnsdupgzd) — PROPOSÉ, PAS APPLIQUÉ.
create role legacy_readonly nologin;
grant usage on schema public to legacy_readonly;
grant select on all tables in schema public to legacy_readonly;
alter default privileges in schema public grant select on tables to legacy_readonly;
```

Puis signer un JWT dont le claim `"role": "legacy_readonly"` est vérifié
avec le JWT secret du projet Canal Cup (Project Settings → API → JWT
Settings — à récupérer manuellement, comme le service role key, jamais
exposé par le connecteur MCP). PostgREST exécute alors chaque requête sous
ce rôle Postgres réel : `INSERT`/`UPDATE`/`DELETE` échouent avec une erreur
`permission denied for table ...`, au niveau du moteur, même avec ce token,
même en contournant `lib/supabase/legacy.ts`. C'est la seule des deux
options qui tient si le `Proxy` est bypassé ou absent.

Inconvénient : signer et faire tourner ce JWT correctement (expiration,
lib de signature) demande un peu d'outillage — à faire dans un script dédié
(`scripts/legacy-audit/`), pas à la main.

**Option B — rotation de la clé service_role Canal Cup (plus simple, moins net)**

Révoquer/régénérer la `service_role` key de Canal Cup dans le dashboard, et
ne conserver dans `.env.local` que l'`anon` key (déjà soumise à RLS). Plus
simple, mais : (a) toute route Canal Cup encore en vie qui utiliserait
l'ancienne clé casserait sans préavis — risque à vérifier avant ; (b) une clé
`anon` reste soumise aux policies RLS existantes de Canal Cup, qui n'ont pas
été auditées pour être "lecture seule" par design (elles datent du jeu, pas
d'un objectif d'audit) — donc moins net que l'Option A.

**Ce qui n'est PAS proposé** : aucune de ces deux options n'est exécutée
tant que tu n'as pas choisi laquelle (ou aucune) — voir contrainte "Ne
modifie rien dans Canal Cup pour obtenir cela sans me présenter d'abord la
solution." Structurellement, je ne pourrais de toute façon pas l'appliquer
moi-même par erreur : le connecteur Supabase MCP que j'utilise pour les
migrations est scopé à l'organisation `vjasdstjdszsekbwazbi` et n'a pas
accès à `qmkbnafilhdhnsdupgzd` (voir point 3 des garde-fous ci-dessus) — si
ceci est un jour approuvé, ça devra passer par le SQL Editor du dashboard
Canal Cup, pas par un outil que j'actionne directement.

## `SUPABASE_SERVICE_ROLE_KEY` (CANAL Sports) — non bloquant pour le schéma

Le schéma référentiel (Sport/Competition/Season/Event, voir plus bas) est
créé et migré via le connecteur Supabase MCP (`apply_migration`), qui
n'utilise pas cette clé — son absence locale ne bloque donc pas ce travail.
Elle reste nécessaire uniquement pour toute route applicative qui
utiliserait `createAdminClient()` au runtime (ex. futures routes admin) :
tant qu'elle n'est pas renseignée dans `.env.local` (placeholder `TODO_...`
actuellement), ces routes doivent être considérées **non testées/non
validées en local**, pas juste "à configurer plus tard". Rappel : cette clé
ne doit jamais être committée dans Git.

## État vérifié (2026-09-25)

- [x] A. Canal Cup identifiée précisément : `qmkbnafilhdhnsdupgzd`.
- [x] B. Canal Cup confirmée READ ONLY (garde-fous ci-dessus + convention).
- [x] C. CANAL Sports créée dans `vjasdstjdszsekbwazbi` : `yfhuqsuboqfznnpceosl`
      (coût vérifié à 0 €/mois avant création).
- [x] D. Project refs distincts vérifiés : `yfhuqsuboqfznnpceosl` ≠
      `qmkbnafilhdhnsdupgzd`.
- [x] E. Nouveau système de migrations initialisé pour CANAL Sports —
      première migration `bootstrap_canal_sports_technical_tables`
      appliquée via le connecteur Supabase MCP (`apply_migration`).
- [x] F. Bootstrap appliqué : `users` (reshape : `football_level` nullable,
      pas de `team_id`/`team_role`), `push_subscriptions`, `app_settings`
      (vide, pas de seed Canal Cup), `cron_runs`, `feedback`,
      `inbox_events` (`team_id` nullable, sans FK). `services` et
      `allowlist_users` **pas encore recréées** — décision reportée (voir
      "Ouvert" ci-dessous).
- [x] G. Écriture contrôlée testée dans CANAL Sports : insertion dans
      `cron_runs` (`job = 'p2-bootstrap-write-test'`), relue avec succès.
- [x] H. Lecture testée dans Canal Cup (REST, clé fournie par
      l'utilisateur, requêtes `GET` uniquement) : comptages obtenus sur 14
      tables sans écriture. Voir tableau d'audit ci-dessous.
- [x] I. Résultats montrés à l'utilisateur (ce document + réponse dans la
      conversation).

## Ouvert / à décider avant de continuer P2

- `SUPABASE_SERVICE_ROLE_KEY` de CANAL Sports (`yfhuqsuboqfznnpceosl`) doit
  être récupérée manuellement depuis le dashboard Supabase (Project
  Settings → API) — non exposée par le connecteur MCP par design.
  `.env.local` contient un placeholder `TODO_...` en attendant. **Non
  bloquant** pour le schéma référentiel (migrations via connecteur MCP) —
  voir section dédiée plus haut ; bloquant seulement pour toute route
  applicative future utilisant `createAdminClient()`.
- Lecture seule Canal Cup : garde-fou `Proxy` documenté comme limite
  applicative, pas garantie base de données — proposition (Option A rôle
  Postgres + JWT dédié, Option B rotation de clé) présentée plus haut,
  **aucune des deux appliquée**, en attente de ton choix.
- `services` (10 lignes) et les 49 comptes collaborateurs : mapping produit
  (voir tableaux ci-dessous), **import non exécuté**. `allowlist_users` :
  recommandation de ne pas importer (mécanisme propre à Canal Cup, à
  remplacer par un vrai système `memberships` côté CANAL Sports).
- Projet `xwmgmewebqbicghhrvfs` (mauvaise organisation) : laissé tel quel,
  décision de nettoyage reportée.
- Lot 2A (abstraction fournisseurs sportifs) livré — voir
  `docs/adr/0003-sport-provider-abstraction.md`. Le POC réel Ligue des
  Champions 2026/27 (`docs/poc-football-providers-cl-2026-27.md`) n'a pu
  vérifier ni football-data.org (clé manquante) ni API-Football (compte
  suspendu) : **HARD STOP**, en attente d'un accès valide à l'un des deux
  avant de considérer ce lot totalement validé et avant tout démarrage du
  Lot 2B (organizations/memberships/users).

## Audit Canal Cup → CANAL Sports (lecture seule, rien importé)

Comptages obtenus le 2026-09-25, sans lecture de données personnelles au
delà des noms de colonnes déjà connus du code (`supabase/schema.sql`,
`supabase/migration_users_v2.sql`).

Données sans valeur pour CANAL Sports (structure déjà recréée vide côté
CANAL Sports quand applicable, aucune ligne reprise) : équipes/binômes (15),
abonnements push (35), réglages app (2 clés), historique cron (844),
retours utilisateurs (2), notifications historiques (9722), matchs WC2026
(108), pronostics (3221), morning briefs (110), matchs babyfoot (15),
questions quiz (437) — exclues explicitement, contenu du jeu Canal Cup
terminé ou feature désactivée pour CANAL Sports.

Les trois données avec une vraie valeur candidate sont mappées ci-dessous
avec la grille demandée. **Aucune de ces lignes n'a été importée** — mapping
uniquement, en attente de validation, et pour les collaborateurs : import
explicitement différé jusqu'à ce que le modèle `users`/`organizations`/
`memberships` de CANAL Sports soit stabilisé (voir "Ordre de P2" plus haut).

### Comptes collaborateurs (49 lignes)

| Colonne | Détail |
|---|---|
| **Canal Cup source** | `public.users` (49 lignes) — colonnes connues : `id, auth_id, email, name, display_name, user_slug, service_id, football_level, team_id, team_role, timezone, onboarding_step, profile_completed, created_at, updated_at` |
| **CANAL Sports cible** | `public.users` (déjà recréée en P1/P2, vide) |
| **Champs conservés** | `email`, `display_name` (ou `name` si `display_name` vide), `service_id` *(si la table `services` est reprise — voir plus bas)*, `timezone` |
| **Champs abandonnés** | `team_id`, `team_role` (concept binôme Canal Cup, absent du nouveau modèle) ; `football_level` (couplé au jeu WC2026, pas un attribut CANAL Sports générique) ; `user_slug` (généré, à recréer proprement plutôt que copié) ; `onboarding_step`/`profile_completed` (état d'un onboarding qui n'existe plus dans sa forme actuelle) |
| **Transformations** | `id` Canal Cup **non réutilisé comme PK** CANAL Sports (nouvel `id` généré) — Canal Cup garde son PK propre, aucune dépendance croisée ; `email` normalisé (`lower/trim`, cohérent avec `lib/auth/email-domain.ts`) avant comparaison |
| **Contraintes / doublons** | `email` doit rester unique côté CANAL Sports ; vérifier au moment de l'import qu'aucun collaborateur n'a déjà recréé un compte CANAL Sports entre-temps (onboarding P1 déjà en prod) — dédoublonner par email, pas par ancien `id` |
| **Stratégie identité Auth** | **Ne pas recréer les comptes Supabase Auth, ne pas migrer de mot de passe.** La ligne `public.users` importée reste une identité *métier* sans `auth_id` tant que la personne ne s'est pas connectée elle-même côté CANAL Sports (magic link / Auth natif à CANAL Sports) — `auth_id` se remplit au premier login réel, pas à l'import. Distinction stricte : `users.id` (métier, importable) ≠ `auth.users.id` (Supabase Auth, jamais importé/recréé) |
| **Recommandation** | Mapping *validé en principe* par toi. Import **non exécuté** : à faire seulement après stabilisation du modèle `users`/`organizations`/`memberships`, pour ne pas migrer vers une structure encore temporaire |

### Services / départements (10 lignes)

| Colonne | Détail |
|---|---|
| **Canal Cup source** | `public.services` (10 lignes) — colonnes réelles observées : `id, name, is_active, sort_order, created_at` (la colonne `emoji` existe dans une migration du dépôt mais pas en base réelle — ne pas la supposer) |
| **CANAL Sports cible** | `public.services` (à créer — pas encore recréée côté CANAL Sports) |
| **Champs conservés** | `name`, `is_active`, `sort_order` |
| **Champs abandonnés** | Aucun — structure déjà générique et indépendante du jeu |
| **Transformations** | Aucune ; nouvel `id` généré côté CANAL Sports (pas de dépendance à l'`id` Canal Cup) |
| **Contraintes / doublons** | `name` unique attendu (à vérifier sur les 10 lignes réelles avant import — pas encore fait, lecture seule des comptages jusqu'ici) |
| **Stratégie identité Auth** | Sans objet — table de référence organisationnelle, aucun lien à `auth.users` |
| **Recommandation** | Bon candidat de réutilisation *telle quelle*, faible risque (pas de PII, pas de couplage jeu). Import **non exécuté** — à rattacher au même chantier que "organisations/services/utilisateurs" dans l'ordre que tu as fixé, pas avant |

### `allowlist_users` (47 lignes) — rôle fonctionnel vérifié dans le code

Vérifié dans `lib/auth/allowlist.ts`, `lib/auth/session.ts`,
`app/api/auth/pre-check/route.ts`, `supabase/allowlist.sql` (pas supposé) :
`allowlist_users` est le **mécanisme de contrôle d'accès et de rôle** de
Canal Cup — `email → is_active (accès autorisé oui/non) + role
(user|admin|super_admin)`. `ensureAllowlisted()` l'utilise pour décider si
un email peut se connecter (auto-ajout si domaine Canal+ requis), et
`getCurrentUserRole()` lit `role` directement depuis cette table (pas
depuis `public.users`) pour les vérifications admin. C'est donc un système
de permissions à plat (une ligne par email, un rôle texte), pas juste une
liste blanche passive.

| Colonne | Détail |
|---|---|
| **Canal Cup source** | `public.allowlist_users` (47 lignes) — `id, email, role (user\|admin\|super_admin), is_active, created_at` |
| **CANAL Sports cible** | **Aucune — pas de table `allowlist_users` recréée** |
| **Champs conservés** | Aucun, en l'état |
| **Champs abandonnés** | La table entière, telle quelle |
| **Transformations** | Sans objet |
| **Contraintes / doublons** | Sans objet |
| **Stratégie identité Auth** | Sans objet |
| **Recommandation** | **Ne pas importer.** Conformément à la consigne ("ne l'importe pas simplement parce qu'elle existe") : c'est un mécanisme de gating + rôle *propre à l'architecture Canal Cup* (auto-inscription par domaine email, rôle plat en texte). Le prochain chantier ("organisations/services/utilisateurs") doit construire un système d'accès/rôles natif à CANAL Sports (probablement `memberships` avec un rôle par organisation, pas un rôle global par email) — réutiliser `allowlist_users` reviendrait à importer une dette d'architecture au lieu de la résoudre. Seule information potentiellement utile *si besoin plus tard* : la liste des emails qui étaient `admin`/`super_admin` (pour ne pas repartir de zéro sur qui doit avoir un accès élevé) — mais ça reste une donnée à relire ponctuellement en lecture seule le moment venu, pas une table à copier |

**Rien n'a été importé.** Les trois lignes ci-dessus sont les seules
candidates réelles — en attente de ta décision, et pour les collaborateurs,
explicitement après stabilisation du modèle `users`/`organizations`/
`memberships`.
