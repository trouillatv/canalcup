# Canal Cup — Architecture v2 publique (référence)

> **Statut** : **DOCUMENT DE RÉFÉRENCE — NE PAS CODER LA V2 MAINTENANT.**
> Priorité absolue = Canal Cup interne RSE pour la Coupe du Monde 2026
> (juin-juillet 2026). La version publique est un chantier post-CdM,
> conditionné à la validation des KPIs internes.
>
> Ce document existe pour :
> 1. Verrouiller les décisions d'architecture déjà prises.
> 2. Éviter le scope creep pendant la préparation CdM.
> 3. Servir de base de discussion en juillet 2026 (post-tournoi).

---

## 1. Vision produit

**Deux produits distincts, même ADN visuel.**

| | Canal Cup Interne (existant) | Canal Cup Public (futur) |
|---|---|---|
| **Cible** | Salariés Canal+ NC | Abonnés Canal+ NC (grand public) |
| **Auth** | Magic link + allowlist | Email + mot de passe / magic link grand public |
| **Volume estimé** | ~30 actifs | 2-5 k DAU max (5-10 % de ~50 k abonnés Canal+ NC) |
| **Cœur du produit** | Cohésion d'équipe, RSE, animations, scoring harmonisé | Pronos + agenda + classement + ligues privées |
| **Modération** | Faible (entre collègues) | Moyenne (CGU, signalement, RGPD) |
| **Réglementaire** | Interne, faible exposition | RGPD, conditions concours (ANJ / NC) |
| **Mise en prod** | Mai-juin 2026 | Cible : CdM Féminine 2027 ou Euro 2028 |

### Killer feature publique
> « Je regarde le match sur Canal+, je fais mon prono en < 10 secondes,
> je vois si je bats mes potes. »

Positionnement : **compagnon des chaînes Canal+**, pas un produit autonome.

---

## 2. Ce qui est partagé entre les deux produits

### Couche données (tables Postgres)
- `matches` — calendrier officiel
- `match_events` — buts, cartons, faits de match
- `teams_football` — équipes nationales WC (les drapeaux, infos officielles)
- `standings` — classement des poules en live
- `wc_teams_static` — données JSON des fiches WC (depuis `data/wc-teams.json`)
- `services` — catalogue services Canal+

### Couche logique (code)
- **Scoring engine** : `lib/scoring/config.ts` (BASE, weights, calculatePoints, phase multipliers, plancher participation). Unique source de vérité pour la règle de score d'un prono.
- **Football sync** : `services/football/*` (TheSportsDB, fetch live scores, settle).
- **Helpers** : `lib/utils.ts` (date NC, teamFlag, slug, etc.).
- **Types** : `Match`, `Team` football, `Prediction` (squelette), `ScoreEvent`, `MatchEvent`.

### Couche UI (design system)
- Tailwind config (couleurs `canal-yellow`, `canal-black`, `canal-gray-*`)
- Font Inter, layout mobile-first
- Composants partageables (à terme dans `components/shared/`) :
  - `MatchCard`, `Countdown`, `Scoreboard`
  - `LeaderboardTable` (squelette générique)
  - `PredictionInput`
  - `TeamLink`, `Badge`, `Button`, `Card`

---

## 3. Ce qui est séparé strictement

| Couche | Interne | Public |
|---|---|---|
| **Auth** | `allowlist_users` + magic link | `auth.users` direct + email/mdp (ou magic link grand public séparé) |
| **Users** | `users` (avec `team_id`, `team_role`, etc.) | `public_users` (id, email, pseudo, opt-in marketing) |
| **Pronostics** | `predictions` (team_id = équipe Canal Cup RSE) | `public_predictions` (sans team_id Canal Cup) |
| **Classements** | Par équipe Canal Cup (3 équipes RSE) | Par user / ligue privée / top NC global |
| **Animations** | `challenges`, `challenge_entries`, `score_events`, `babyfoot_matches` | ❌ aucune (animations RSE = interne only) |
| **TV mode** | `/tv` mur d'affichage salon | ❌ absent |
| **IA** | matinale, coach, génération d'histoires | ❌ pas d'IA grand public |
| **Admin** | `/admin/*` (allowlist admin) | `/p/admin/*` modération minimale séparée |
| **RLS** | `auth.uid() = users.auth_id` | `auth.uid() = public_users.auth_id` (policies indépendantes) |

---

## 4. Tables publiques futures (proposition)

À créer **post-CdM** uniquement, dans une migration dédiée. Schémas :
soit préfixe `public_*` dans le schéma `public` (pragmatique, peu de refactor),
soit schéma Postgres dédié `public_app.*` (plus propre, plus de boulot).

### Structure minimale

```sql
-- Users du grand public
public_users (
  id uuid pk,
  auth_id uuid unique not null,    -- lien Supabase Auth
  email text not null,
  pseudo text not null,
  user_slug text unique,
  marketing_opt_in boolean default false,
  created_at timestamptz default now()
);

-- Pronostics publics (pas de team_id Canal Cup)
public_predictions (
  id uuid pk,
  user_id uuid references public_users(id),
  match_id uuid references matches(id),       -- partagé
  predicted_score_a int,
  predicted_score_b int,
  prediction_result text check (in ('A','DRAW','B')),
  points_awarded int default 0,
  created_at timestamptz default now(),
  unique (user_id, match_id)
);

-- Ligues privées entre amis
public_leagues (
  id uuid pk,
  name text not null,
  invite_code text unique not null,
  created_by_user_id uuid references public_users(id),
  created_at timestamptz default now()
);

public_league_members (
  league_id uuid references public_leagues(id),
  user_id uuid references public_users(id),
  joined_at timestamptz default now(),
  primary key (league_id, user_id)
);

-- Préférences notifications
public_reminders (
  user_id uuid references public_users(id),
  type text check (in ('match','daily','weekly')),
  enabled boolean default true,
  primary key (user_id, type)
);
```

Pas d'autres tables au MVP. Pas de `public_score_events`, pas de
`public_challenges`, pas de `public_babyfoot`. **La simplicité est la
killer feature.**

---

## 5. Routes futures (route group `(public)`)

```
app/
├── (internal)/             ← TOUTES les routes actuelles (renommage léger)
│   ├── page.tsx            ← dashboard RSE
│   ├── predictions/
│   ├── animations/
│   ├── babyfoot/
│   ├── admin/
│   ├── tv/
│   └── profile/
└── (public)/               ← À CRÉER post-CdM
    └── p/
        ├── page.tsx        ← landing publique (agenda prochains matchs + countdown)
        ├── predictions/    ← prono rapide < 10 sec
        ├── leaderboard/    ← top NC + top ligues
        ├── leagues/        ← créer/rejoindre une ligue privée
        ├── agenda/         ← calendrier complet
        ├── profile/        ← compte public
        └── (auth)/
            ├── signup/
            └── signin/
```

Le préfixe `/p/` permet de :
- Réutiliser le même domaine Vercel (pas de DNS supplémentaire à gérer).
- Mapper plus tard `canalcup.nc` → `/p/*` via Vercel rewrites quand on
  veut une URL publique propre, sans toucher au code.

---

## 6. Risques RGPD et réglementaires

### RGPD (la version publique change la donne)
- **Finalité** : pronos, classement, push notif. À documenter dans CGU/POL.
- **Base légale** : consentement (opt-in case à cocher au signup).
- **Données collectées** : email, pseudo, IP de connexion, pronos historiques.
  Pas plus.
- **Durée de conservation** : 2 ans après dernière connexion, puis purge.
- **Droit à l'oubli** : endpoint admin pour supprimer un compte +
  cascade sur `public_predictions`, `public_league_members`.
- **DPO Canal+** : valider avant lancement.

### Concours / paris
- Les pronos avec récompenses tombent potentiellement sous l'ANJ
  (France métropolitaine) et la réglementation locale NC.
- Solution simple : **rewards symboliques uniquement** (badge,
  classement, mention TV), **pas de prix monétaire ni équivalent**.
- Si récompenses monétaires un jour : règlement de concours déposé +
  conditions de participation visibles.

### Modération
- **Pseudo** : filtre regex anti-insultes basique au signup.
- **Ligues** : nom de ligue filtré au create + signalement possible.
- **Pas de chat, pas d'UGC libre.** C'est l'anti-pattern n° 1.

---

## 7. Anti-scope creep (règles d'or)

Avant de coder quoi que ce soit côté public, **vérifier les 5 règles** :

1. **Toute feature publique doit tenir en une phrase pour un abonné
   Canal+.** Si ça prend plus, c'est trop complexe.
2. **Pas de social libre.** Pas de chat, pas de feed, pas d'upload
   d'images, pas de réseau d'amis sans invitation.
3. **Pas d'IA côté public.** Le contexte interne (matinale, coach) est
   spécifique RSE. Pour le public, simplicité radicale.
4. **Pas de Sofascore / Fantasy.** On ne joue pas sur ce terrain — les
   gratuits sont meilleurs. Notre différenciation = la **tendance des
   pronos abonnés Canal+** sur les matchs en direct, et le **lien avec
   les chaînes**.
5. **Pas de cross-contamination de données.** Un utilisateur public ne
   doit jamais voir un email/pseudo interne, et inversement. RLS
   stricte, deux espaces de noms (`users` vs `public_users`).

### Liste explicite des features à NE PAS porter au public
- ❌ Animations RSE, défis, photos uploadées
- ❌ Babyfoot, scoring babyfoot
- ❌ TV mode salon
- ❌ Hall of Shame, clashs, humour interne
- ❌ Matinale IA, coach IA, génération d'histoires
- ❌ Score harmonisé G2 (la pondération est interne)
- ❌ Multi-équipes par utilisateur (le public a une seule "équipe" éventuelle = sa ligue privée)

---

## 8. Stratégie de mise en œuvre (phases)

### Phase 0 — Préparation passive (préc CdM, optionnel)
- Ce document existe (✓).
- READMEs minimaux dans `components/shared/`, `components/internal/`,
  `components/public/` pour matérialiser la convention.
- Aucun composant déplacé. Aucune table créée.

### Phase α — Refacto modulaire (post-CdM, par lots)
- `git mv` des composants partageables vers `components/shared/`
  (`MatchCard`, `Countdown`, `Scoreboard`, `LeaderboardTable`,
  `PredictionInput`, `TeamLink`, `Badge`).
- Extraire `lib/shared/` (scoring, football, date-nc, types).
- Garder `lib/internal/` pour ce qui est RSE-only (`challenges`,
  `babyfoot`, `score_events` interne).
- Aucune migration DB, aucun changement de route.

### Phase γ — Tables publiques (post-CdM, migration dédiée)
- Créer les 5 tables `public_*` ci-dessus.
- RLS posées dès la création (`auth.uid() = public_users.auth_id`).
- Aucune UI encore.

### Phase δ — UI publique MVP (sur décision produit)
- `app/(public)/p/page.tsx` → landing.
- Routes `predictions`, `agenda`, `leaderboard`, `leagues`.
- Signup / signin séparés de l'interne.

### Phase ε — Bascule publique
- Mapping domaine (Vercel rewrites) si besoin d'une URL propre.
- Ouverture des inscriptions aux abonnés Canal+ NC.
- KPIs définis avant lancement : DAU, taux d'engagement, retention J7.

### Phase ζ — Split monorepo (si la v2 décolle)
- Quand : > 1 k DAU OU 2 équipes maintiennent OU les deux cycles de
  déploiement interfèrent.
- Migration : Turborepo / pnpm workspaces, `lib/shared/` → `packages/shared/`.
- ~2 jours de boulot quand le moment vient.

---

## 9. Décisions de gouvernance

### Avant tout dev public
- ✅ Validation post-CdM des KPIs internes (DAU, NPS, engagement).
- ✅ Sponsor exécutif Canal+ NC identifié.
- ✅ Discussion SSO myCANAL : possible ? combien de mois ? → bloque ou
  non le timeline ?
- ✅ Discussion myCANAL : module dans l'app existante ou app séparée ?
- ✅ Validation juridique : DPO Canal+, réglementation NC, ANJ.
- ✅ Définition des 3 KPIs de succès AVANT le lancement (pas après).

### Décisions à prendre AU MOMENT du lancement public
- Domaine : `app.canalcup.nc/p/` ou `canalcup.nc` ?
- Auth : email/mdp ou magic link grand public ?
- Tarification ? (par défaut : gratuit, financé par engagement Canal+)
- Stratégie d'acquisition : push email Canal+, encart myCANAL, etc.

---

## 10. Ressources

- Discussion initiale : conversation Claude Code 2026-05-21.
- Repo : `canalcup` (GitHub).
- Stack actuel : Next.js 15 App Router + Supabase + Vercel.
- Données football : TheSportsDB sync via `/api/cron/sync-matches`.
- Conventions visuelles : `app/globals.css`, `tailwind.config.ts`.

---

_Dernière mise à jour : 2026-05-21. Ce document doit être relu et
validé avant tout démarrage du chantier public._
