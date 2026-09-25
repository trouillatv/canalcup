# Stratégie de repository — CANAL Sports

Statut : décision P1, à revalider avant toute bascule en production.

## État au moment de l'écriture (P1)

- `trouillatv/canalcup` est le seul repo existant. Figé au tag
  `world-cup-2026-final` (commit `1bc7cdd`) sur `main`, poussé sur origin.
- Aucun repo `trouillatv/canal-sports` (ou nom équivalent) n'existe sur
  GitHub — vérifié via `gh repo list trouillatv`.
- Aucun projet Vercel ni Supabase dédié à CANAL Sports n'a été créé.

## Choix retenu pour P1 : bootstrap sur une branche du repo existant

Les fondations CANAL Sports (feature flags, config produit, design system
minimal, squelette `/cs/*`, ADRs) sont construites sur la branche
`canal-sports-foundation` du repo `canalcup`, **pas** `main` (qui reste au
tag de clôture). Raisons :

- Le principe validé avec l'utilisateur est "bootstrap, pas page blanche" —
  réutiliser l'infra générique (auth Supabase, push, monitoring cron,
  feedback) sans la dupliquer dans un repo vide au jour 1.
- Créer un nouveau repo/Vercel/Supabase maintenant serait une ressource
  distante irréversible sans qu'on ait encore validé ensemble le nom
  produit final, l'organisation GitHub cible, ni le plan Supabase.

## Ce qu'il reste à créer (pas fait, listé pour validation avant action)

| Ressource | Action à valider | Remarque |
|---|---|---|
| Repo GitHub | Créer `trouillatv/<nom-final>` (ou renommer/fork `canalcup`) | Nom produit pas figé (`CANAL Sports` provisoire) |
| Projet Vercel | Créer un projet pointant sur le nouveau repo | Domaines/env vars à redéfinir, pas de secrets à copier tels quels |
| Projet Supabase | Créer un projet neuf | Voir `docs/supabase-bootstrap-strategy.md` — pas de migration de la base Canal Cup |
| Variables d'environnement | Réémettre (API-Football, Gemini, VAPID push, Supabase) | Ne jamais réutiliser telles quelles des clés de prod Canal Cup pour un nouveau projet |

Aucune de ces actions n'a été effectuée en P1. Elles nécessitent une
validation explicite (création de ressources distantes = hors périmètre
"HARD STOP" du prompt P0/P1).

## Quand basculer vers un repo séparé ?

Recommandation : au moment où (a) le nom produit est figé et (b) la
première compétition réelle (Champions League, P2) doit être déployée
pour de vrais utilisateurs. Avant ça, continuer à itérer sur la branche
`canal-sports-foundation` évite de multiplier les synchronisations entre
deux repos pendant que l'architecture bouge encore.
