# `data/matches/` — données de match de référence

Ces fichiers ne sont **pas** des fichiers temporaires. Ils sont la **source de
référence** des matchs qu'ils décrivent : si la base est perdue ou reconstruite,
il suffit de relancer l'import pour retrouver l'état exact.

```bash
node scripts/import-match-captures.js           # dry-run + rapport de complétude
node scripts/import-match-captures.js --apply   # écrit (snapshot automatique)
```

Le script est idempotent : le relancer ne crée pas de doublon.

## Pourquoi ces fichiers existent

Le plan API-Football gratuit ne couvre pas la Coupe du Monde 2026. Les matchs de
phase finale sont donc arrivés en base sans compositions, sans notes et sans
événements — le centre du match était vide. Les captures Sofascore rangées dans
`public/Matchs/` sont la seule source disponible, et ces JSON en sont la
transcription vérifiable.

## Doctrine

**On n'importe que ce qui est observé.** Une donnée absente de la capture reste
`null` — jamais inférée, jamais complétée par une estimation. Les entraîneurs
sont `null` sur trois des quatre matchs pour cette seule raison, alors que leur
nom est connu par ailleurs.

**Le nom n'est jamais une clé métier.** `player_id` reste `null` à l'import ; la
correspondance vers un joueur canonique passe par la table `player_aliases`,
rattachable plus tard sans réimport. Deux pièges rencontrés qui justifient cette
règle :

- « L. Martínez » du onze argentin est **Lisandro** (défenseur), alors que le
  buteur de la 90'+2 en demi-finale est **Lautaro** — deux joueurs distincts
  sous le même nom abrégé ;
- les buteurs sont nommés en entier dans l'en-tête (« Kylian Mbappé ») et
  abrégés dans les compositions (« K. Mbappé »). D'où le champ explicite
  `lineup_player_name`, à `null` pour un buteur entré en cours de jeu.

## Format

| Bloc | Rôle |
|---|---|
| `source` | provenance : `provider`, `image`, `captured_at`, `transcribed_by`, `validated_by`, `method` |
| `match` | identifiant en base + équipes (contrôlés à l'import : un écart d'équipes fait échouer) |
| `referee`, `venue`, `managers`, `formations`, `team_ratings` | valeurs portant chacune sa `confidence` |
| `motm` | homme du match, uniquement s'il est explicitement désigné sur la capture |
| `lineups` | onze de départ : `number`, `player_name`, `rating`, `confidence`, cartons, `subbed_off` |
| `events` | buts, avec `lineup_player_name` pour le lien explicite vers la composition |
| `absent_from_capture` | ce que la capture ne montre pas, en clair |

Chaque valeur incertaine porte une `confidence` inférieure à 1. Le rapport de
dry-run les liste, ce qui permet de retrouver les données douteuses sans relire
les captures.

## Limite connue

Seul l'onglet *Lineups* de Sofascore a été capturé. Les statistiques d'équipe
(possession, tirs, corners) et les minutes des cartons et remplacements ne sont
donc disponibles pour aucun de ces matchs.
