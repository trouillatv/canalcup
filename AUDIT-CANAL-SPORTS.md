# Canal Cup → CANAL Sports — Rapport d'audit et de bifurcation

*Audit en lecture seule, dépôt cloné depuis `github.com/trouillatv/canalcup` (branche `main`, à jour, working tree propre). 7 audits parallèles menés sur l'ensemble du code, du schéma Supabase et des scripts.*

---

## 1. État actuel du projet

- **Stack** : Next.js 15 (App Router) + React 19 + TypeScript, Supabase (Postgres/Auth/RLS), API-Football + TheSportsDB (données foot), Gemini 2.5 Flash (contenu IA), Web Push (VAPID), déployé sur Vercel.
- **Taille** : ~707 fichiers versionnés, 53 scripts opérationnels, ~65 fichiers de migration SQL (deux systèmes parallèles, cf. §7).
- **Git** : dépôt propre, aucun changement non commité. Dernier commit `1bc7cdd` ("Anime le Top 10 journée par journée", 24/07/2026), dans la continuité directe de la séquence de clôture (`86d465c` → `1bc7cdd`, 21–24/07). **Aucun tag n'existe actuellement.**
- **Branches distantes** : 20 branches. 8 sont déjà fusionnées dans `main` (dont `feat/babyfoot-tournament`, `babyfoot-bracket-et-correctifs-points`) — nettoyables. 11 branches `claude/*` ne sont **pas** fusionnées (probablement abandonnées/expérimentales) — à trier avant nettoyage, ne rien supprimer sans validation.
- **Doc interne pré-existante notable** : `docs/PUBLIC_VERSION_ARCHITECTURE.md` montre que l'équipe avait déjà anticipé un pattern "shared / internal / public" (dossiers `components/{shared,internal,public}` déjà scaffoldés mais vides pour `shared`/`public`). C'est une base de réflexion réutilisable pour la séparation générique/spécifique que nous visons, même si elle a été pensée pour "même jeu, public différent" et non "sports différents".

---

## 2. Cartographie des modules (vue d'ensemble)

| Domaine | Emplacement | Rôle |
|---|---|---|
| Auth/session | `lib/auth/**`, `app/auth/**`, `middleware.ts` | Login magic-link Supabase, gate domaine `canal-plus.com`, rôles |
| Admin | `app/admin/**` (18 sous-sections) | Back-office : users, monitoring, scoring, quiz, babyfoot, jokers, cloture, etc. |
| Notifications/push | `app/api/push/**`, `app/api/inbox/**`, `lib/push.ts` | Web Push générique + feed d'événements |
| Monitoring/cron | `app/api/cron/**`, `lib/monitoring/**`, `vercel.json` | 6 crons quotidiens, logs génériques |
| Matchs/données foot | `app/matches`, `app/football`, `services/football/**`, `lib/football/**` | Ingestion API-Football/TheSportsDB, un seul tournoi codé en dur |
| Pronostics | `app/predictions`, `app/api/predictions/**` | Un seul marché : score exact |
| Scoring | `lib/scoring.ts`, `services/scoring/settle.ts` | Barème foot + multiplicateurs de phase WC |
| Équipes collègues | `app/teams`, `app/binomes`, `lib/teams/config.ts` | Binômes (max 2), captain/member, invite code |
| Équipes nationales (contenu) | `app/wc-team`, `app/wc-teams`, `data/wc-teams.json` | Fiches équipes WC2026, lecture seule |
| Classements | `lib/data/teams.ts`, `lib/scoring/config.ts`, `app/leaderboard` | 4 piliers figés (pronos/quiz/babyfoot/animations) |
| Réputation/badges | `lib/data/reputation.ts`, `app/badge/**` | Moteur générique, contenu 100% foot/WC |
| Quiz | `app/quiz*`, `lib/quiz/**` | Moteur live+solo générique, contenu WC-only |
| Babyfoot | `app/babyfoot/**`, `app/bracket/**`, `lib/babyfoot/**` | Tournoi interne, moteur de bracket générique |
| Jokers | `app/jokers/**`, `lib/jokers/**` | 8 modificateurs de pronostic, mécanique générique |
| Supporters/Moments/Vestiaire/Matinale/Revivez | `app/{supporters,moments,vestiaire,matinale,revivez}/**` | UGC, chat, digest quotidien — primitives sociales génériques |
| Cérémonie/TV | `app/final`, `app/admin/cloture`, `app/tv/**`, `lib/event/**` | Écrans kiosque de clôture, majoritairement jetables |
| Feedback | `app/api/feedback`, `app/admin/feedback` | Déjà conçu comme portable (doc l'indique explicitement) |
| Challenges/QR | `app/admin/challenges`, `app/admin/qr` | Primitives génériques d'engagement/points |
| IA génération | `services/ai/**` | Gemini non-abstrait, plomberie générique, prompts foot/WC |
| IA comité produit | `services/agents/**` | Outil de dev interne, générique, hors scope produit |
| Design system | `components/ui/**` (2 fichiers seulement) | Quasi inexistant, à reconstruire |

---

## 3. À conserver quasiment tel quel (A)

- **Client Supabase** (`lib/supabase/server.ts`, `client.ts`, `admin.ts`) — wrappers purs, zéro couplage schéma.
- **Push générique** (`lib/push.ts`, `app/api/push/**`, `public/sw.js`) — payload générique, table `push_subscriptions` neutre.
- **Monitoring cron** (`lib/monitoring/cron-log.ts`, table `cron_runs`) — wrapper générique déjà utilisé par tous les crons.
- **Feedback** (`app/api/feedback`, `app/admin/feedback`, `components/feedback/FloatingFeedback.tsx`) — la doc `FEEDBACK_FEATURE.md` dit explicitement que c'est conçu pour être copié tel quel dans un autre projet Next.js+Supabase.
- **`next.config.ts`, `package.json`** — génériques, aucune dépendance sport-spécifique.
- **Statut `matches.status` / cycle de vie compétition** (`lib/event/status.ts`, `status-core.ts`) — mécanisme ouverture/fermeture propre et testé, généralisable en "cycle de vie de saison/événement".
- **Moteur de bracket babyfoot** (`lib/babyfoot/generate.ts`, `standings.ts`) — algorithme pur (seeding, byes, élimination directe), zéro logique sportive, directement réutilisable pour tout mini-tournoi interne futur.
- **Catalogue Jokers** (`lib/jokers/catalog.ts`) — mécanique générique de "modificateur de pronostic", aucun contenu WC.
- **Plomberie IA** (`services/ai/gemini.ts`, `cache.ts`, `cost-tracker.ts`) — appel Gemini + cache + suivi de coût, zéro connaissance football.
- **Comité produit IA** (`services/agents/**`) — outil de décision interne au build, déjà générique dans son mécanisme.
- **Challenges & QR** (`app/admin/challenges`, `app/admin/qr`, tables `challenges`/`qr_counters`) — primitives d'engagement/points déjà découplées du foot.

---

## 4. À conserver mais à généraliser (B)

| Élément | Ce qui doit changer |
|---|---|
| `matches` → `events` | Ajouter `sport_id`, `competition_id`, `season_id`, `event_type` ; remplacer `phase`/`stage` (texte libre WC) par un `stage`/`round_order` piloté par compétition |
| `services/football/sync.ts` | Extraire une interface `SportProvider` par sport (foot garde API-Football/TheSportsDB ; F1/rugby auront leurs propres sources) au lieu de constantes `APIF_WC_LEAGUE=1`/`APIF_WC_SEASON=2026` en dur |
| `predictions` | Ajouter `market_type_id` + `payload jsonb` au lieu de `predicted_score_a/b` figés ; la table `bonus_predictions` (déjà `prediction_type` + `predicted_value` texte) est un bon embryon de ce pattern |
| `lib/scoring.ts` / `services/scoring/settle.ts` | Passer d'une fonction unique de calcul foot à un registre de "scorers" par `market_type`, découplé du concept `match` ; sortir les effets de bord jokers/IA/push du chemin de règlement générique (hooks plutôt qu'appels inline) |
| Équipes collègues (`lib/teams/config.ts`) | `TEAM_MAX_MEMBERS=2` en dur → configurable par produit/challenge ; `teams`/`team_memberships` évoluent vers `organizations`/`memberships` (boutique/service/groupe informel) |
| Classement (`lib/scoring/config.ts`) | Les 4 piliers pronos/quiz/babyfoot/animations sont figés dans le code (commentaire "À FIGER AVANT LE COUP D'ENVOI") — remplacer par une config par saison/compétition, pas une constante globale |
| Réputation/badges (`lib/data/reputation.ts`) | Moteur d'agrégation générique à garder, mais les ~25 titres/badges sont 100% foot/WC (continents FIFA, "Spécialiste Brésil", phases KO en français) — à réécrire par sport |
| Quiz (`lib/quiz/**`) | Moteur de session live/solo générique — juste remplacer le contenu (`seed_quiz_worldcup.sql`) par une banque de questions par sport/compétition |
| Bracket babyfoot (wrapper applicatif) | Le moteur pur est A, mais l'habillage (inscription, "binôme", photos) est spécifique au babyfoot — à généraliser en "mini-tournoi interne" template |
| Supporters/Moments/Vestiaire/Matinale/Revivez | Primitives UGC/chat/digest génériques dans leur structure, mais copie et branding 100% Canal Cup — à renommer/rethémer, pas à réécrire |
| Design system (`components/ui`, `tailwind.config.ts`) | Quasi inexistant (2 fichiers) — le vrai design vit dispersé dans les composants métier ; palette `canal-*` à retravailler en tokens sémantiques |
| Brief IA (`services/ai/generators/match-story.ts`, `morning-brief.ts`) | Plomberie réutilisable comme base du futur "Brief 20 secondes", mais prompts et données d'entrée 100% foot — nécessite un modèle de contexte générique par sport |
| Profil (`app/profile`, `users.football_level`) | Champ `football_level` (CHECK expert/amateur/ambiance) bloque l'onboarding pour un sport non-foot — à généraliser ou sortir de la contrainte `users_profile_complete_chk` |

---

## 5. À mettre de côté / feature flag (C)

- **Babyfoot** (habillage applicatif complet) — moteur gardé en B, wrapper en C.
- **Jokers** (l'expérience utilisateur autour, pas le catalogue) — Kamikaze/Jet Lag/etc. sont amusants mais spécifiques à la tonalité Canal Cup.
- **Supporters (galerie photo), Moments, Vestiaire (chat), Matinale, Revivez** — primitives sociales à garder en réserve, potentiellement réactivables pour l'animation commerciale, mais hors scope du MVP pronostics.
- **`lib/tv/hype.ts`** (moteur de rotation d'écrans TV data-driven) — mécanique généralisable, mais contenu 100% blagues internes Canal Cup ; à garder comme squelette, pas comme contenu.
- **Whoscored experiment** (`lib/football/whoscored-adapter.ts`, flag `ENABLE_WHOSCORED_EXPERIMENT`) — seul exemple existant de pattern feature-flag propre dans le code, à prendre comme modèle pour flaguer le reste.

⚠️ **Aucun système de feature-flag centralisé n'existe aujourd'hui.** Il n'y a qu'un flag global ouverture/fermeture (`app_settings.event_status`) et un flag isolé (`ENABLE_WHOSCORED_EXPERIMENT`). Construire un vrai registre de flags par module (quiz/babyfoot/jokers/social) est un prérequis technique avant de "mettre de côté sans supprimer" les fonctionnalités C.

---

## 6. À abandonner (D)

- **Cérémonie de clôture & écrans TV événementiels** (`app/final`, `app/admin/cloture`, `app/tv/{finale,chaos,deguisement,jokers-slackers}`) — pages "Palmarès Canal Cup 2026", jour déguisement, mur de la honte : jetables.
- **Classement à 4 piliers Canal Cup** (`lib/scoring/config.ts` en tant que valeurs, pas structure) — pondération pronos/quiz/babyfoot/animations propre à la métagame interne CANAL+.
- **Toutes les données statiques WC2026** : `lib/football/groups-2026.ts` (12 groupes × 4 équipes), `lib/football/bracket-2026.ts` (bracket complet codé en dur), `data/wc-teams.json` (26 370 lignes), `lib/football/wc-attackers-2026.ts`.
- **Tout `supabase/one-shot_*.sql`** (~20 fichiers) — confirmé sans exception : corrections manuelles pour une personne (« Vincent »), équipes de test nommées ("Les Cassos", "rayo_palace"), matchs QA fictifs.
- **~20 scripts one-shot dans `scripts/`** — simulateurs de matchs, backfills de calendrier WC, règlements manuels de pronostics bonus (Espagne championne/Mbappé buteur codés en dur), corrections jokers ponctuelles.
- **`seed.sql`, `seed_quiz_worldcup.sql`** — contenu de démo/trivia 100% WC2026 (structure réutilisable comme gabarit, contenu à jeter).
- **Migrations de données ponctuelles** : `migration_matches_calendar_v1.sql` (72 matchs WC insérés en dur), `diag_move_pronos.sql`/`move_pronos_apply.sql`.

---

## 7. Dette technique importante

1. **Deux systèmes de migration Supabase parallèles et non intégrés** : 49 fichiers `supabase/migration_*.sql` (non horodatés, ordre par convention de nom, appliqués via `scripts/migrate.js` custom) + 16 fichiers `supabase/migrations/` (format CLI Supabase standard, phase plus récente). Aucune source de vérité unique du schéma actuel — `schema.sql`/`init.sql` sont obsolètes par rapport au schéma réellement en production. **Recommandation ferme : migrations CLI Supabase exclusivement dès le nouveau projet.**
2. **Design system quasi absent** — `components/ui/` ne contient que 2 fichiers ; le vrai design est dispersé dans les dossiers métier (`components/football`, `components/quiz`...). Prévoir un vrai chantier de design system pour le nouveau produit, pas une simple extraction.
3. **Fournisseur IA non abstrait** — tous les générateurs appellent `gemini.ts` directement (fetch brut vers l'API Gemini), aucune interface de provider. Pas bloquant à court terme, mais à corriger avant d'opérer plusieurs années.
4. **Duplication de logique d'agrégation** — `getLeaderboard`/`getIndividualLeaderboard` (classement) et `getReputationMap` (badges) recalculent indépendamment les mêmes données brutes (`predictions`, `quiz_answers`, `babyfoot_matches`...) sans source commune.
5. **Aucun système de snapshot de classement** — tout est recalculé à la volée à chaque chargement (`revalidate=60`), aucune notion de période (semaine/mois/saison). Bloquant pour les "challenges boutiques" périodiques envisagés dans la vision produit.
6. **Colonne `teams.total_points` morte** — dette identifiée explicitement en commentaire dans le code ("seed demo debt"), plus lue nulle part.
7. **Table `matches` unique, non polymorphe** — aucune séparation sport/compétition/saison ; toute la modélisation événementielle repose sur une seule table taillée pour un seul tournoi de football.
8. **Contrainte de profil bloquante** (`users_profile_complete_chk`) exige `football_level` pour considérer un profil complet — bloquerait l'onboarding d'un utilisateur sur un produit non-foot si non retravaillée en premier.
9. **Nommage "canalcup" en dur dans certains noms de table** (`canalcup_moments`, `canalcup_moment_reactions`) — renommage nécessaire, pas juste une histoire de contenu.

---

## 8. Dépendances Coupe du Monde (logique codée en dur)

Sweep ciblé effectué sur `app/`, `lib/`, `components/`, `services/` (hors SQL et scripts, couverts en §6). **Top 5 des points les plus risqués à démêler en premier :**

1. **`lib/football/groups-2026.ts`** — structure 48 équipes / 12 groupes importée directement dans **29+ fichiers** (bracket, fiches équipes, onboarding, pronostics). Aucune abstraction "N équipes / M groupes" — c'est le plus gros verrou pour supporter un autre format de tournoi.
2. **La chaîne `competition` comme clé de filtrage en base** (`services/football/sync.ts`, `app/api/bracket/route.ts`, `app/api/schedule/route.ts`, `app/api/admin/monitoring/route.ts`) — toutes les requêtes filtrent sur les littéraux `"FIFA World Cup 2026"` / `"Coupe du Monde 2026"` au lieu d'une clé étrangère `competition_id`. Ajouter une deuxième compétition = modifier chaque point d'appel un par un.
3. **Type `TournamentPhase`** (`lib/supabase/types.ts`) + ~15 vérifications par chaîne littérale (`match.phase === "Groupe"`) — les noms de round sont figés à la fois dans le système de types et dans des conditions éparses.
4. **Dates/calendrier statiques** (`lib/tournament.ts` `WC_START_ISO`, `lib/football/bracket-2026.ts` ~16 timestamps ISO en dur) — pilotent le verrouillage des pronostics et le déroulé du bracket ; doivent devenir une config par tournoi, pas des constantes de module.
5. **Absence de registre de feature-flags par module** — un seul interrupteur global (`event_status`), aucun moyen de désactiver indépendamment quiz/babyfoot/jokers/cérémonie.

Autres points notés : noms de variable d'environnement tous génériques (aucun n'est nommé "WC"/"2026"/"CANALCUP" — la dette est dans le code, pas dans la config) ; ~152 fichiers contiennent la chaîne "Canal Cup" (branding, majoritairement inoffensif en UI, mais présent aussi dans les prompts IA système — `services/ai/prompts.ts`).

---

## 9. Proposition de modèle de données cible

En fusionnant les deux esquisses issues de l'audit domaine événements/pronostics et domaine équipes/classement :

```
-- Référentiel sport
sports(id, slug, name)                              -- football, f1, rugby, motogp
competitions(id, sport_id, slug, name)               -- champions_league, top14, world_cup, f1
seasons(id, competition_id, year, label, starts_at, ends_at, is_active)

-- Événements (généralisation de "matches")
events(id, season_id, slug, starts_at, venue, status enum(upcoming|live|halftime|finished|postponed),
       stage text, round_order int, broadcast jsonb, external_ids jsonb)
participants(id, competition_id, kind enum(team|driver|player), name, meta jsonb)
event_participants(id, event_id, participant_id, side text, seed int, result jsonb)

-- Pronostics (marchés extensibles)
market_types(id, sport_id, code, label, payload_schema jsonb, scorer_key text)
                                                      -- exact_score, winner, pole_position, podium, spread
predictions(id, user_id, event_id, market_type_id, payload jsonb,
            points_awarded int default 0, created_at, unique(user_id, event_id, market_type_id))
scoring_rules(id, competition_id, market_type_id, round_pattern text, base_points int, multiplier numeric)

-- Organisations / classements (généralisation de "teams")
organizations(id, type enum(boutique|service|groupe_libre), name, parent_id, zone, logo_url, color)
memberships(user_id, organization_id, role enum(member|manager|captain), is_primary, joined_at)
join_requests(id, organization_id, user_id, status, decided_by, decided_at)

users(id, auth_id, name, display_name, email, service_id → organizations,
      timezone, engagement_level, onboarding_step)   -- football_level généralisé/retiré

scoring_events(id, user_id, organization_id, season_id, sport_id, pillar, category, raw_points, source_type, created_at)
ranking_snapshots(id, season_id, period enum(global|weekly|monthly), scope enum(individual|organization),
                   subject_id, rank, total_points, computed_at)
scoring_config(season_id, sport_id, pillar_weights jsonb, expected_max_raw jsonb)  -- plus jamais en dur dans le code

badges(key, sport_id nullable, category, criteria jsonb)  -- data-driven, pas des fonctions TS
```

Tables à **garder inchangées structurellement** (génériques) : `push_subscriptions`, `cron_runs`, `feedback`, `qr_counters`, `challenges`/`challenge_entries`, `joker_wallets/plays/effects` (renommer le vocabulaire de `joker_type`), moteur babyfoot (`babyfoot_*` renommé en "mini_tournament_*" générique si réactivé).

---

## 10. Proposition d'architecture applicative

- **Couche provider par sport** : interface `SportProvider` (`getEvents`, `getEventDetail`, `syncStandings`) — le foot garde API-Football/TheSportsDB comme implémentation, F1/rugby/MotoGP branchent leurs propres sources plus tard. Le cron `sync-matches` devient un orchestrateur générique qui boucle sur les compétitions actives.
- **Registre de marchés de pronostic** : chaque `market_type` déclare un composant de saisie (client), un validateur (serveur), et un "scorer" (fonction pure `résultat_événement + payload → points`). Ajouter un nouveau marché = ajouter une entrée au registre, pas réécrire le moteur.
- **Règlement générique** (`settleEvent(eventId)`) découplé des effets de bord : jokers, notifications, génération IA de récit deviennent des hooks abonnés à l'événement "settled", pas des appels en dur dans `settle.ts` comme aujourd'hui.
- **Registre de feature-flags par module** (nouveau, à construire) — modèle sur `ENABLE_WHOSCORED_EXPERIMENT`, mais centralisé et par domaine (quiz/babyfoot/jokers/social/cérémonie), piloté par config plutôt que dispersé.
- **Reprendre le pattern shared/internal/public déjà amorcé** dans `components/{shared,internal,public}` (actuellement vide côté shared/public) comme structure de dossier pour séparer moteur générique vs habillage spécifique.
- **IA générative paramétrée par sport** : extraire les templates de prompt de `services/ai/prompts.ts` pour accepter un objet `{sport, terminology, tone}` au lieu de chaînes "football"/"pronostic" en dur ; garder la plomberie (cache, coût, appel Gemini) telle quelle.
- **Provider LLM à abstraire** (non bloquant MVP, mais à prévoir) — extraire une interface derrière `gemini.ts` pour ne pas être verrouillé sur un seul fournisseur.

---

## 11. Proposition UX

Le schéma cible (Accueil "cette semaine" / Programme / Pronostics / Brief / Classements / Notifications) est cohérent avec l'existant et largement réalisable par réutilisation :

- **Programme** → généralisation de `app/schedule`, `app/programme`, `app/matches` déjà présents ; filtres sport/compétition à ajouter (n'existent pas aujourd'hui, un seul sport = un seul flux).
- **Pronostics** (ouverts/faits/résultats/historique) → `app/predictions` existe déjà dans cette forme, il faut juste le rendre agnostique au type de marché (cf. §9).
- **Brief** → nouveau, mais `services/ai/generators/match-story.ts` est le meilleur point de départ (pattern "contexte par événement → un artefact généré, dédupliqué par event_id"), plus proche de ce besoin que `morning-brief.ts` (qui est un digest quotidien, pas un brief pré-événement). Il manque aujourd'hui les données d'horaire de diffusion et de contexte structuré (forme, qualification) pour les sports autres que le foot — à faire porter par le nouveau modèle `events`/`participants`.
- **Classements** (individuel/boutique/service) → `getServiceLeaderboard` existe déjà et correspond presque exactement au besoin "classement boutique" ; il manque la dimension période (semaine/mois/saison), à construire (§7 point 5).
- **Notifications** → infra push déjà générique et réutilisable telle quelle ; seul le contenu des déclencheurs (cron match-specific) est à généraliser.

---

## 12. Stratégie nouvelle Supabase

**Aucune migration destructive n'a été effectuée ni n'est recommandée sur la base Canal Cup.** Recommandations pour le nouveau projet Supabase :

| Données | Action |
|---|---|
| `users`, `allowlist_users` (identités) | **Migrer les données** — conserver les comptes collaborateurs pour éviter une ré-inscription |
| `teams`/`team_memberships` | Recréer vide (nouvelles équipes pour le nouveau produit) |
| `matches` et tout le domaine football WC (`match_events`, `standings`, `mystery_players`...) | **Ne pas migrer** — données d'instance WC2026 |
| `predictions`, `score_events` (période WC) | **Ne pas migrer** |
| `quiz_questions/answers/session` | Recréer le schéma vide, moteur réutilisable, contenu à jeter |
| `babyfoot_*` | Ne pas migrer les données ; transformer/réutiliser la structure si le mini-tournoi est réactivé |
| `joker_wallets/plays/effects` | Transformer la structure (vocabulaire `joker_type` à généraliser), pas de migration de données |
| `canalcup_moments*`, `revivez_posts`, `vestiaire_*`, `supporter_photo_*` | Transformer/renommer le schéma (retirer le préfixe "canalcup"), pas de contenu migré |
| `feedback`, `page_views`, `qr_counters`, `cron_runs`, `admin_logs`, `ai_cost_logs`, `app_settings` | Recréer vide (données opérationnelles/éphémères) |
| `push_subscriptions` | Ne pas migrer (tokens périmés) — les utilisateurs se réabonnent |

**Outillage** : adopter exclusivement les migrations CLI Supabase horodatées dès le premier jour (cf. dette technique §7.1) — ne pas reproduire le système `migration_*.sql` + `scripts/migrate.js` maison.

---

## 13. Stratégie Git / nouveau repository

1. **État vérifié** : `main` propre, à jour avec origin, aucun changement non commité.
2. **Dernier commit de clôture** : `1bc7cdd` ("Anime le Top 10 journée par journée", 2026-07-24), fin de la séquence de cérémonie commencée en `86d465c`.
3. **Tag recommandé** : `world-cup-2026-final` sur `1bc7cdd`. *(Non créé — à confirmer pour ajout.)*
4. **Nettoyage de branches** : 8 branches distantes déjà fusionnées dans `main` (dont `feat/babyfoot-tournament`, `babyfoot-bracket-et-correctifs-points`) sont supprimables sans perte ; 11 branches `claude/*` ne sont **pas** fusionnées — à trier avant toute suppression (ne pas les supprimer sans validation explicite).
5. **Nouveau dépôt** : deux options — (a) fork/clone propre du contenu actuel vers un nouveau repo GitHub `canal-sports` (historique complet conservé, point de départ identique), ou (b) nouveau repo initialisé à vide avec import sélectif des modules classés A/B seulement (historique perdu mais dépôt plus propre dès le départ). Option (a) recommandée pour ne rien perdre, suivie d'un premier commit de nettoyage listant explicitement ce qui est désactivé (§5) et supprimé (§6).
6. **Aucun push vers un nouveau dépôt distant ne sera effectué sans validation explicite**, conformément à la consigne initiale.

---

## 14. Roadmap de migration par lots

**P0 — Geler Canal Cup**
Objectif : figer l'archive.
Fichiers/modules : aucun changement de code ; tag Git uniquement.
Migrations : aucune.
Risques : faible.
Critères d'acceptation : tag `world-cup-2026-final` posé, confirmation qu'aucun déploiement ne pointe plus vers ce repo comme "produit actif".

**P1 — Créer le nouveau socle**
Objectif : nouveau repo + nouveau projet Supabase vide, infra Vercel dupliquée.
Fichiers concernés : tout ce classé A (§3) copié tel quel ; suppression physique des dossiers classés D (§6).
Migrations : schéma vide, migrations CLI Supabase dès le départ.
Risques : décisions de nommage (produit, org Supabase) à prendre en amont.
Critères d'acceptation : app déployable, login fonctionnel, aucune donnée WC2026 présente.

**P2 — Généraliser sport/competition/season/event**
Objectif : remplacer `matches` par le modèle `sports/competitions/seasons/events` (§9).
Fichiers : `services/football/sync.ts`, `lib/football/**`, `app/matches`, `app/api/matches`, `app/api/football`, schéma `events`/`participants`.
Migrations : nouvelles tables, migration du provider foot vers l'interface `SportProvider`.
Risques : élevé — c'est le cœur du système, forte dépendance transverse (29+ fichiers touchés par `groups-2026.ts` seul).
Critères d'acceptation : un événement de Champions League peut être créé, synchronisé et affiché sans aucune référence à "Coupe du Monde"/"2026" en dur.

**P3 — Généraliser les pronostics**
Objectif : introduire `market_types` + `predictions.payload`, moteur de scoring en registre.
Fichiers : `app/predictions`, `app/api/predictions`, `lib/scoring.ts`, `services/scoring/settle.ts`.
Migrations : `market_types`, `scoring_rules`, transformation de `predictions`.
Risques : moyen-élevé — nécessite de définir au moins 2 marchés dès le départ (score exact + vainqueur) pour valider la généricité.
Critères d'acceptation : ajouter un nouveau type de marché (ex. "vainqueur du GP") ne nécessite aucune modification du moteur de règlement, seulement une nouvelle entrée de registre.

**P4 — Programme + briefs**
Objectif : écran Programme multi-sport/multi-compétition + moteur de Brief généralisé.
Fichiers : `app/schedule`, `app/programme`, `services/ai/generators/match-story.ts` → générateur de brief générique.
Migrations : ajout `broadcast`/horaires NC sur `events`.
Risques : moyen — dépend de la disponibilité de données structurées (forme, qualification) par sport, absentes aujourd'hui hors foot.
Critères d'acceptation : un brief "20 secondes" généré pour un événement non-foot avec les champs pertinents uniquement.

**P5 — Classements individuel/boutique**
Objectif : `organizations`/`memberships` + classement par période.
Fichiers : `lib/data/teams.ts`, `lib/data/users.ts`, `lib/scoring/config.ts`, `app/leaderboard`, `app/teams`.
Migrations : `organizations`, `memberships`, `scoring_config` par saison, `ranking_snapshots`.
Risques : moyen — nécessite de trancher le modèle de période (snapshot vs calcul à la volée avec fenêtre de dates).
Critères d'acceptation : classement boutique filtrable par semaine/mois/saison, sans pondération codée en dur.

**P6 — Notifications**
Objectif : généraliser les déclencheurs de push (aujourd'hui liés à `matches`).
Fichiers : `app/api/cron/match-start-push`, `match-reminder-push`, `lib/push.ts` (déjà générique).
Migrations : aucune côté `push_subscriptions`.
Risques : faible.
Critères d'acceptation : notification programmable pour tout type d'événement (course F1, match de rugby), pas seulement un match de foot.

**P7 — Pilote Champions League**
Objectif : premier cas d'usage réel de bout en bout sur le nouveau socle.
Fichiers : configuration compétition/saison, données participants CL.
Migrations : seed CL (équipes, calendrier réel).
Risques : dépend de la disponibilité/fiabilité d'une source de données CL (API-Football couvre déjà la CL, à vérifier niveau plan tarifaire).
Critères d'acceptation : cycle complet pronostic → règlement → classement fonctionnel sur un vrai calendrier CL.

**P8 — Mesure d'usage**
Objectif : instrumentation (déjà `page_views` générique) + tableaux de bord d'adoption par boutique.
Fichiers : `lib/monitoring/**`, nouveaux dashboards admin.
Migrations : aucune majeure.
Risques : faible.
Critères d'acceptation : visibilité sur taux de participation par boutique/service, disponible pour arbitrer P9.

**P9 — Ouverture à F1/rugby**
Objectif : brancher un deuxième `SportProvider` non-foot, valider la généricité réelle du modèle.
Fichiers : nouveau provider (ex. Ergast pour F1), nouveaux `market_types` (pole position, podium).
Migrations : seed sport F1/rugby.
Risques : élevé si des hypothèses foot-only ont survécu en P2-P3 (ex. notion de "mi-temps", "score" par défaut) — c'est le vrai test de l'architecture cible.
Critères d'acceptation : un utilisateur peut pronostiquer un Grand Prix F1 sans qu'aucun code du domaine foot n'ait été touché.

---

**Prochaine étape suggérée** : valider ensemble les sections 9 (modèle de données) et 14 (découpage des lots), poser le tag `world-cup-2026-final`, puis démarrer P0/P1.
