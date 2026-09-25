# ADR 0002 — Event Brief et provenance des faits générés par IA

Statut : **proposé**, non implémenté. Documentation seule — aucun moteur
"Event Brief" n'est construit en P1. Objectif : poser la règle avant que
quiconque (moi y compris, en P2+) ne code un générateur qui invente des
faits sportifs.

## Contexte

Canal Cup a déjà un plumbing Gemini fonctionnel (`services/ai/*`) : un
client (`services/ai/gemini.ts`), un registre de prompts
(`services/ai/prompts.ts`), des générateurs par usage
(`generators/morning-brief.ts`, `roast.ts`, `coach.ts`, `fun-fact.ts`,
etc.), un cache (`cache.ts`), un tracker de coût (`cost-tracker.ts`), et un
mode mock (`mock.ts`, activé via `MOCK_AI=true`). C'est un bon socle
technique. Mais son usage actuel est **éditorial/ambiance**, pas
factuel : "fail of the day", fun facts, commentaires d'ambiance — un
contenu inexact n'a aucune conséquence.

Le "Brief" envisagé pour CANAL Sports est différent : il doit donner à
l'utilisateur des informations sur lesquelles il peut baser un pronostic
(forme récente, absences, enjeu de qualification, horaire, chaîne de
diffusion). Si l'IA invente un fait ici — un joueur blessé qui ne l'est
pas, un classement erroné, un horaire faux — la conséquence n'est plus
cosmétique, c'est une désinformation qui peut biaiser une décision et
nuire à la crédibilité du produit.

## Décision

### Règle non négociable

**L'IA ne doit jamais inventer un fait sportif structurant.** Concrètement,
interdiction de génération libre pour :

- Classement / position au tableau
- Blessures, suspensions, indisponibilités
- Qualification / enjeu sportif (ce qui se joue dans ce match)
- Horaire, lieu, diffuseur
- Forme récente (résultats des derniers matchs)
- Statistiques (buts, cartons, possession, historique face-à-face)

Si une de ces informations doit apparaître dans un Brief, elle **doit
provenir d'une source structurée fournie en entrée du prompt** (données de
`EventContext`, voir plus bas) — jamais générée à partir de la
"connaissance" du modèle. Ce que l'IA peut faire librement : mettre en
forme, résumer, donner un ton, créer une accroche — jamais ajouter un fait
qui n'est pas dans le contexte fourni.

Ce n'est pas une nuance théorique : le pattern actuel
(`morning-brief.ts` ligne ~57, `PROMPTS.morningBrief(ctx)`) construit déjà
le prompt à partir d'un contexte structuré (`scores`, `leaderboard`,
`failTeam`, `matchTonight` — des chaînes déjà calculées côté serveur, pas
laissées à l'imagination du modèle) et PAS à partir de rien — c'est le bon
réflexe, il faut le formaliser et l'étendre, pas le réinventer.

### Pipeline EventContext → Brief

```
Sources structurées (DB, API sportive, cache)
        │
        ▼
   EventContext            ← objet typé, assemblé côté serveur
        │
        ▼
  Brief generator (prompt)  ← Gemini, formate/résume, n'invente pas
        │
        ▼
      Brief                ← texte final, stocké, avec métadonnées de provenance
```

- **EventContext** : objet construit AVANT l'appel IA, à partir de
  sources vérifiables (résultat de requête DB, réponse d'API sportive
  citée, jamais du texte libre déjà halluciné par un appel précédent).
  Exemple de forme (indicative, pas un schéma figé — sera précisé au
  moment de l'implémentation P2+) :
  ```ts
  interface EventContext {
    event: { id: string; startsAt: string; venue?: string; broadcaster?: string };
    participants: Array<{ id: string; name: string; recentForm?: string[] }>;
    standings?: { source: string; asOf: string; rows: unknown[] };
    stakes?: string; // texte factuel préparé côté serveur, pas généré
    sourcedFacts: Array<{ fact: string; source: string; fetchedAt: string }>;
  }
  ```
  Chaque champ qui alimente un fait "sensible" (cf. liste ci-dessus) porte
  sa source et sa date de fraîcheur.
- **Brief generator** : reçoit un `EventContext` complet, produit un texte
  narratif. Le prompt système doit explicitement instruire le modèle de
  ne PAS ajouter de fait absent du contexte fourni, et de signaler
  (plutôt que d'improviser) quand une donnée demandée n'est pas
  disponible (ex: "forme récente non disponible" plutôt qu'une forme
  inventée).
- **Provenance/fraîcheur** : chaque `Brief` stocké doit conserver une trace
  de (a) quel `EventContext` (ou snapshot/hash) a servi à le générer, (b)
  à quelle date/heure les données sources ont été récupérées (`fetchedAt`
  par fait, pas une seule date globale — un score peut être frais alors
  qu'un classement date de la veille). Permet, en cas de contestation
  ("le brief dit un truc faux"), de savoir si c'est une hallucination du
  modèle ou une donnée source déjà obsolète au moment de la génération.

### Ce qui n'est PAS fait en P1

- Pas d'implémentation d'`EventContext` ni de générateur Brief réel —
  seulement la règle et le schéma indicatif ci-dessus.
- Pas de connecteur vers une nouvelle API sportive (F1, rugby, MotoGP) —
  dépend du choix de fournisseur de données, hors périmètre P1.
- Le plumbing Gemini existant (`services/ai/*`) est réutilisable tel quel
  au niveau technique (client, cache, cost-tracker) ; seuls les nouveaux
  générateurs "Brief factuel" devront respecter cette ADR — les
  générateurs d'ambiance existants (`roast.ts`, `fun-fact.ts`,
  `wall-of-shame.ts`...) restent inchangés et hors périmètre (ils sont de
  toute façon masqués via feature flags pour CANAL Sports, voir
  `lib/features/flags.ts`).

## Alternatives rejetées

- **Laisser le modèle chercher/compléter les faits via son savoir
  général** (pas de contexte structuré, prompt du type "fais un brief sur
  le match PSG-Real de ce soir") — rejeté : c'est exactement le mode qui
  produit des hallucinations de blessures/classements/horaires, invérifiable
  et non traçable.
- **Grounding via recherche web en direct par le modèle** (function
  calling / browsing) — pas rejeté définitivement, mais hors périmètre
  P1 : ajoute une dépendance et une source d'erreur supplémentaire
  (fiabilité de la recherche elle-même) sans qu'on ait encore de
  fournisseur de données sportives fiable choisi pour les sports hors
  foot. À réévaluer si un jour aucune source structurée n'est disponible
  pour un fait donné.

## Conséquences

- Tout futur générateur "Brief" doit être revu contre cette règle avant
  merge : si un prompt ne reçoit pas explicitement les faits qu'il est
  censé restituer, c'est un bug, pas une IA "créative".
- `EventContext` devient un prérequis du modèle de données de l'ADR 0001
  (`Event`, `EventParticipant`, `result`) — le Brief consomme ces
  entités, il ne les remplace pas et ne les invente pas.
- Nécessite, en P2+, de choisir des sources de données par sport
  (API-Football déjà en place pour le foot ; à définir pour F1/rugby/
  MotoGP) avant de pouvoir construire un `EventContext` complet pour ces
  sports — un Brief F1 sans source de classement n'a pas à inventer un
  classement, il doit simplement omettre ce champ.
