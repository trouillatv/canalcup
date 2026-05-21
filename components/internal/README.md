# `components/internal/`

**Composants spécifiques à Canal Cup Interne (RSE).**

## Règles

- Ce dossier contient les composants qui n'ont de sens **que dans le
  contexte RSE / cohésion d'équipe / animations bureau**.
- Peuvent dépendre de `components/shared/` et `lib/shared/`.
- Peuvent dépendre de `lib/internal/` (data layer RSE).
- **Ne sont jamais importés depuis** `components/public/` ou `app/(public)/`.

## À terme, contiennent

- Composants animations (challenges, photos, score events).
- Composants babyfoot (bracket interne, formulaires de score).
- Composants TV mode (slides salon, classements en grand).
- Composants admin RSE (modération entries, attribution de points).
- `TeamCaptainPanel.tsx`, `MyTeamsPanel.tsx` (équipes Canal Cup
  internes — 3 équipes, captain, demandes pending).
- `ScoreBreakdown.tsx` (pondération G2 interne).

## Convention import

```ts
// ✅ OK
import { MatchCard } from "@/components/shared/MatchCard";
import { calculatePoints } from "@/lib/shared/scoring";

// ✅ OK (intra-internal)
import { ChallengeRow } from "@/components/internal/ChallengeRow";

// ❌ JAMAIS
import { LeagueCard } from "@/components/public/LeagueCard";
```

> Voir `docs/PUBLIC_VERSION_ARCHITECTURE.md`.
> **Dossier en cours de constitution** — pour l'instant, les composants
> RSE vivent dans `components/teams/`, `components/scoring/`,
> `components/matches/`. Le déménagement se fera post-CdM, par lots.
