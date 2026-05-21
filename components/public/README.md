# `components/public/`

**Composants spécifiques à Canal Cup Public (grand public Canal+).**

## Statut actuel

**Dossier vide intentionnellement.** Le chantier public est post-CdM 2026.
Aucun composant ici tant que la version publique n'a pas été validée
produit après le tournoi.

## À terme, contiendra

- `LeagueCard.tsx` — carte ligue privée avec code d'invitation.
- `LeaderboardPublic.tsx` — top NC global, top par ligue.
- `ReminderToggle.tsx` — préférences de notifications.
- `PublicSignupForm.tsx`, `PublicSigninForm.tsx`.
- Variantes de `MatchCard` si différentes (mais idéalement la même
  via `components/shared/MatchCard.tsx`).

## Règles

- Peut dépendre de `components/shared/` et `lib/shared/`.
- Peut dépendre de `lib/public/` (data layer public — tables `public_*`).
- **Ne dépend JAMAIS** de `components/internal/` ou `lib/internal/`.
- **N'importe jamais** des données RSE (`challenges`, `score_events`,
  `babyfoot_matches`, `teams` Canal Cup interne, etc.).

## Anti-scope creep — ce dossier ne doit PAS contenir

- ❌ Animations RSE, défis, photos.
- ❌ TV mode salon.
- ❌ Composants IA (matinale, coach).
- ❌ Score harmonisé G2.
- ❌ Multi-équipes (le public a une ligue privée éventuelle, pas une
  hiérarchie d'équipes Canal Cup).

> Voir `docs/PUBLIC_VERSION_ARCHITECTURE.md` pour la liste exhaustive
> des features publiques validées vs refusées.
