# Canal Cup — Clôture officielle & cérémonie finale — Design

**Date :** 2026-07-21
**Statut :** ✅ IMPLÉMENTÉ (2026-07-21) — voir §10 pour ce qui a été livré et les arbitrages retenus.

## 1. Objectif

Quand la Canal Cup 2026 est terminée, l'application bascule en **mode clôture** :

1. Une **page de cérémonie finale** (vitrine read-only) présente tous les classements officiels
   déjà settlés, dans une mise en scène de fin de tournoi.
2. Un **verrou global** empêche toute nouvelle écriture de jeu (pronos, quiz, jokers, kamikazes,
   inscriptions, matchs, votes…). Les pages historiques restent consultables en lecture seule.

Le signal qui pilote tout est un **drapeau global unique** : `app_settings.event_status`
(`'open'` | `'closed'`).

## 2. Principes directeurs (non négociables)

- ❌ **Aucun recalcul** à la fermeture. La cérémonie **lit** des points déjà settlés.
- ❌ **Aucune modification** de score ou de classement.
- ❌ **Aucun classement fabriqué.** Pas de « meilleur joueur baby-foot » (donnée inexistante).
- ✅ **Unités jamais mélangées.** Chaque classement affiche clairement son unité :
  **Équipes**, **Joueurs** ou **Binômes**.
- ✅ **Zéro duplication de logique** entre la home et `/final` (un seul composant), et entre
  serveur/client pour le verrou (un seul helper + un flag exposé).
- ✅ Les **outils admin de correction restent disponibles** dans l'espace admin, séparés du
  parcours public et clairement signalés.

## 3. Interrupteur global « Canal Cup terminée »

### 3.1 Source de vérité

Table `app_settings` (déjà présente, key/value jsonb). Nouvelle clé :

```
key = 'event_status'   value = "open"   (défaut implicite si absent)
                        value = "closed"
```

Aucune migration de schéma nécessaire (la table existe). La clé peut être absente → traitée
comme `open`.

### 3.2 Helper serveur (source unique)

Nouveau module `lib/event/status.ts` :

```ts
export type EventStatus = "open" | "closed";
export async function getEventStatus(admin?): Promise<EventStatus>  // lit app_settings, cache court
export async function isCompetitionClosed(): Promise<boolean>
export async function requireCompetitionOpen(): Promise<void>       // throw / renvoie 403 si closed
```

- Lecture via le client admin (les routes n'ont pas toutes RLS ouverte sur `app_settings`).
- **Cache court en mémoire** (ex. 30–60 s) pour ne pas requêter à chaque POST. Cache invalidé
  quand l'admin bascule le drapeau (voir 3.4).
- `requireCompetitionOpen()` lève une erreur typée que les routes convertissent en
  `403 { error: "competition_closed" }`.

### 3.3 Exposition au client (pour masquer les boutons)

Le flag doit être lisible côté client pour désactiver les CTA de jeu. Deux voies, on retient la
plus simple sans nouvel appel réseau :

- Le **layout serveur** (`app/layout.tsx` ou un provider) lit `getEventStatus()` une fois et le
  passe via un contexte React `EventStatusProvider` → hook `useEventStatus()`.
- Fallback / SSR-safe : les pages serveur qui rendent des CTA reçoivent déjà le flag en prop.

Le client ne fait **jamais autorité** : il masque/désactive pour l'UX, le serveur refuse
réellement l'écriture.

### 3.4 Bascule par l'organisation

- Route existante `app/api/admin/settings/route.ts` (PATCH upsert) sait déjà écrire `app_settings`.
- On ajoute un **contrôle admin** minimal (un toggle « Ouvrir / Clôturer la compétition ») dans
  un écran admin, qui PATCH `event_status` et **invalide le cache** du helper.
- Réversible : rebascule `open` sans effet de bord (rien n'a été recalculé).

## 4. Verrou global des écritures (read-only lock)

### 4.1 Serveur (autoritatif)

Ajouter `await requireCompetitionOpen()` **après l'auth**, en tête de chaque handler d'écriture.
Renvoie `403 { error: "competition_closed" }` si fermé.

Routes à garder (POST/PUT/PATCH/DELETE) — liste issue de l'inventaire :

| Mécanique | Fichier |
|---|---|
| Prono match | `app/api/predictions/route.ts` |
| Prono bonus | `app/api/predictions/bonus/route.ts` |
| Jokers | garde unique dans `lib/jokers/service.ts` `playJoker` (couvre play) + `app/api/jokers/spy/route.ts` |
| Quiz live | `app/api/quiz/answer/route.ts` |
| Quiz solo | `app/api/quiz/solo/answer/route.ts` |
| Baby-foot inscription | `app/api/babyfoot/register/route.ts` |
| Baby-foot friendly/partner/photo | `app/api/babyfoot/{friendly,partner,photo}/route.ts` |
| Équipes | `app/api/teams/{create,join,rename,membership/*,requests/*}` |
| Binômes | `app/api/binomes/{request,respond,cancel}/route.ts` |
| Supporters | `app/api/supporters/{entry,vote,var,relance,comments,reactions,moderate}/route.ts` |
| Moments | `app/api/moments/{entry,comments,reactions,moderate}/route.ts` |
| Vestiaire | `app/api/vestiaire/messages/*` |
| Commentaires/réactions match | `app/api/matches/[id]/{comments,reactions}/route.ts` |
| Feedback | `app/api/feedback/route.ts` |

**Exclus du verrou** (nécessaires en lecture seule / auth) : `middleware.ts`, `app/api/profile/*`,
`app/api/auth/*`, `app/api/inbox/read`, `app/api/track`, `app/api/push/subscribe`, **tout
`app/api/admin/*`** (corrections orga) et `app/api/cron/*` (le settlement final peut encore tourner).

**Note write-on-read jokers :** `expireStaleEffects` / `getActiveEffectsForUser` /
`getAllActiveEffects` (dans `lib/jokers/service.ts`) font des UPDATE de nettoyage à la lecture.
C'est inoffensif (statut d'effet expiré). Sous `closed`, on les rend **no-op** pour un verrou
réellement sans écriture.

### 4.2 Client (UX)

Via `useEventStatus()` : quand `closed`, masquer/désactiver les CTA de jeu (bouton pronostiquer,
jouer un joker, répondre au quiz, s'inscrire, poster une photo/commentaire, etc.) et afficher un
état « Compétition terminée ». Les listes/historiques restent affichés.

### 4.3 Bannière globale

Un bandeau discret persistant (dans le layout) quand `closed` :
« **Canal Cup 2026 terminée — voir le palmarès** » avec lien vers `/final`.

## 5. Page de cérémonie

### 5.1 Routing & anti-duplication

- **Composant unique** `components/final/ClosingCeremony.tsx` (**Server Component**) : fait tous
  les fetchs read-only et rend la cérémonie complète.
- **`/final`** (`app/final/page.tsx`) : rend `<ClosingCeremony />`. URL stable, partageable,
  projetable. Accessible même si `open` ? → décision : accessible seulement quand `closed`
  (sinon redirige vers home) pour éviter d'exposer une cérémonie prématurée. *(à confirmer)*
- **Home** (`app/page.tsx`) : quand `getEventStatus() === 'closed'`, rend `<ClosingCeremony />`
  au lieu du contenu habituel. Sinon, home normale.
- Aucune logique de données dupliquée : les deux montent le même composant.

### 5.2 Sources de données (toutes read-only, déjà existantes)

| Section | Fonction / endpoint | Source | Unité |
|---|---|---|---|
| Général | `getLeaderboard()` (`lib/data/teams.ts`) | agrégat déjà en place | **Équipes** |
| Pronos | `getIndividualLeaderboard()` (`lib/data/teams.ts`) → champ `pronos` | `predictions`+`bonus`+casino | **Joueurs** |
| Quiz | `GET /api/quiz/leaderboard` → `ranking` | `quiz_answers`+`quiz_session` | **Joueurs** |
| Baby-foot | `GET /api/babyfoot` → `podium`, `matches`, `classement`, `stats` | tournoi actif | **Binômes** |

Le composant serveur appelle directement les fonctions `lib/data/*` (pas via HTTP) quand
possible ; pour quiz/babyfoot qui passent par des routes, réutiliser les fonctions sous-jacentes
si exposées, sinon fetch interne.

### 5.3 Structure de la page (ordre imposé)

1. **Hero de clôture**
   - « 🏆 La Canal Cup 2026 est terminée »
   - « Les résultats sont définitifs »
   - « Passez voir l'équipe Marketing pour récupérer vos récompenses »
2. **Podium — Classement général** · badge unité **Équipes** (🥇🥈🥉)
3. **Classement général complet** (Position · Équipe · Points)
4. **Podium — Pronostics** · badge unité **Joueurs**
5. **Classement Pronostics complet** (Position · Joueur · Points)
6. **Podium — Quiz** · badge unité **Joueurs**
7. **Classement Quiz complet** (Position · Joueur · Points)
8. **Baby-foot** · badge unité **Binômes**
   - Podium des binômes
   - Bracket : demi-finales · petite finale · finale (avec scores)
   - Résultats complets par phase (phase de groupes → demies → petite finale → finale)
   - Classement final des binômes (Position · Binôme · Points · Matchs · V · D)
9. **Hall of Fame** (uniquement données existantes et fiables) :
   - Champion Baby-foot (binôme)
   - Finaliste Baby-foot (binôme)
   - Troisième Baby-foot (binôme)
   - Vainqueur des Pronostics (joueur)
   - Vainqueur des Quiz (joueur)
   - Champion Canal Cup (équipe — 1re du classement général)
   - *(dérivables du baby-foot sans nouvelle règle : « Score le plus large » et « Match le plus
     serré », calculés depuis les scores de matchs déjà enregistrés — à confirmer si on les inclut)*
10. **Bloc Récompenses** — encart très visible :
    - « 🎁 Les récompenses sont prêtes ! »
    - « Les gagnants peuvent passer voir l'équipe Marketing pour récupérer leurs lots. »
    - illustration cadeau
11. **Galerie / souvenirs** — seulement si des photos existent (`/api/babyfoot` photos) ; upload
    désactivé, galerie en lecture.

Chaque bloc de classement porte un **badge d'unité** explicite (Équipes / Joueurs / Binômes) pour
ne jamais laisser croire qu'on compare des choux et des carottes.

### 5.4 Animation (une seule fois à l'ouverture)

- Pluie de **confettis** SSR-safe (réutiliser le pattern déterministe de `app/quiz-show/page.tsx`
  + keyframe `confettiFall`, **sans `Math.random`/`Date.now`**).
- Coupe qui apparaît + léger effet de célébration.
- **Puis plus rien** — pas d'animation permanente. Déclenchement une fois par montage
  (ex. flag en `sessionStorage` ou simple état initial).

### 5.5 Design

Tailwind + tokens maison existants (`canal-card`, `canal-headline`, `text/bg-canal-yellow`,
`score-display`…), `lucide-react`, locale `fr-FR`, timezone `Pacific/Noumea`. Rendu « cérémonie de
fin de tournoi » : sobre, solennel, résultats mis en avant, appel à l'action Marketing clair.

## 6. Hors périmètre (YAGNI)

- Pas de nouveau moteur de scoring ni de recalcul.
- Pas de « meilleur joueur baby-foot ».
- Pas de refonte des pages de classement existantes (elles restent, en lecture seule).
- Pas d'archivage/versioning d'édition (l'interrupteur est réversible, ça suffit).

## 7. Tests & vérification

- **Helper `getEventStatus`/`requireCompetitionOpen`** : unitaire (open → passe, closed → 403,
  clé absente → open, cache).
- **Routes verrouillées** : au moins un test par mécanique clé (prono, joker, quiz, inscription)
  renvoyant 403 quand `closed`.
- **Cérémonie** : rendu du composant avec données mockées ; badges d'unité présents ; sections
  absentes gèrent le cas « données vides ».
- **Non-régression** : quand `open`, comportement inchangé partout (home normale, écritures OK).
- Vérification manuelle : bascule admin `open`↔`closed`, home + `/final`, un essai d'écriture bloqué.

## 8. Déroulé d'implémentation (indicatif, découpé)

1. **Interrupteur** : `lib/event/status.ts` + toggle admin + exposition client (`useEventStatus`).
2. **Verrou serveur** : `requireCompetitionOpen()` sur les routes listées + no-op jokers.
3. **Verrou UI + bannière** : masquage CTA + bandeau global.
4. **Cérémonie** : `ClosingCeremony` (fetchs + sections + badges), montée par `/final` et la home.
5. **Animation** : confettis + coupe one-shot.
6. **Hall of Fame + bloc Récompenses**.
7. Tests + vérif manuelle + push.

## 9. Questions ouvertes — TRANCHÉES

- `/final` accessible seulement quand `closed` → **retenu**, avec une exception : les
  **organisateurs** y accèdent même en `open` (prévisualisation). Sans ça, la seule façon de
  relire la page avant le jour J aurait été de clôturer pour de vrai.
- « Score le plus large » / « Match le plus serré » → **inclus** (dérivés de scores déjà
  enregistrés, aucune nouvelle règle).
- Toggle admin → **page dédiée `/admin/cloture`** (tuile sur le dashboard admin), avec double
  confirmation. Un interrupteur qui verrouille tout le site n'avait pas sa place noyé dans un
  écran de réglages.

## 10. Livré

| Élément | Fichier |
|---|---|
| Logique pure (parse + cache, fail-open) | `lib/event/status-core.ts` |
| Helper serveur + `competitionLock()` | `lib/event/status.ts` |
| Contexte client + `useCompetitionClosed()` | `components/event/EventStatusProvider.tsx` |
| Bandeau global « Canal Cup terminée » | `components/event/ClosedBanner.tsx` (monté par `app/layout.tsx`) |
| Cérémonie (composant unique) | `components/final/ClosingCeremony.tsx` |
| Confettis one-shot SSR-safe | `components/final/CeremonyConfetti.tsx` |
| Page palmarès | `app/final/page.tsx` |
| Bascule home → cérémonie | `app/page.tsx` |
| Bascule orga | `app/admin/cloture/page.tsx` + `app/api/admin/event-status/route.ts` |
| Verrou d'écriture | **40 routes** `app/api/**` + no-op de `expireStaleEffects` |
| Tests | `lib/event/status-core.test.ts` (7) + `lib/event/lock-coverage.test.ts` (2) |

Écart assumé vs §7 : pas de test d'intégration HTTP par route (le projet n'a pas de harnais de
routes, seulement le runner Node sur du pur). Remplacé par un test **structurel** qui parcourt
`app/api` et échoue si une route d'écriture n'est ni verrouillée ni exemptée explicitement —
il couvre le vrai risque : la route ajoutée dans six mois qu'on oublierait de verrouiller.
