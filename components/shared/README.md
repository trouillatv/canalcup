# `components/shared/`

**Composants design system partagés entre Canal Cup Interne et Canal Cup Public.**

## Règles

- Ce dossier contient **uniquement** des composants UI réutilisables qui
  n'ont AUCUNE connaissance du contexte produit (interne vs public).
- Ils acceptent leurs données en **props** et ne fetchent jamais directement
  une route ou une table « interne-only » comme `challenges`, `babyfoot_matches`,
  `score_events`, etc.
- Ils respectent l'identité visuelle Canal Cup : noir / blanc / jaune, layout
  mobile-first, font Inter, ton broadcast.

## À terme, contiennent (déplacement post-CdM)

- `MatchCard.tsx` — carte match avec drapeaux + countdown + statut.
- `Countdown.tsx` — compte à rebours réutilisable.
- `Scoreboard.tsx` — affichage gros score type TV.
- `LeaderboardTable.tsx` — table de classement générique (rang + ligne + total).
- `PredictionInput.tsx` — saisie d'un prono (score A vs score B).
- `TeamLink.tsx` — lien équipe + drapeau cliquable.
- `Badge.tsx`, `Button.tsx`, `Card.tsx` — primitives design system.

## Ne contient PAS

- Composants RSE (animations, babyfoot, TV mode) → `components/internal/`.
- Composants spécifiques au grand public (ligues privées, signup) →
  `components/public/`.

## Convention import

```ts
// ✅ OK depuis un composant interne ou public
import { MatchCard } from "@/components/shared/MatchCard";

// ❌ JAMAIS depuis components/shared/* :
import { ChallengeRow } from "@/components/internal/ChallengeRow"; // KO
import { LeagueCard } from "@/components/public/LeagueCard";       // KO
```

> Voir `docs/PUBLIC_VERSION_ARCHITECTURE.md` pour le plan d'ensemble.
> **Dossier intentionnellement vide pour l'instant** — les déplacements
> se feront post-CdM, par lots, pour ne pas casser l'app interne.
