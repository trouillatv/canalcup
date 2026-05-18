# Enrichissement joueurs — Canal Cup WC2026

Prépare une **base joueurs propre** des sélections de la Coupe du Monde 2026
pour enrichir : compos, quiz, « qui est ce joueur », stats joueurs, affichage
TV, match center.

> ⚠️ Outil **hors-ligne / intermédiaire**. Aucun appel frontend, aucune
> intégration directe à l'app. Produit un JSON vérifiable **avant** tout
> import Supabase.

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `enrich_players.py` | Script multi-sources, feature-flaggé, robuste |
| `output/players_worldcup_2026.json` | JSON intermédiaire généré (à vérifier à la main) |
| `scrape_wc2026.py` | (existant) scraper Transfermarkt → CSV, à lancer **ponctuellement** |

## Installation

```bash
pip install requests          # chemin par défaut (TheSportsDB)
pip install beautifulsoup4 lxml   # seulement si Transfermarkt expérimental
```

Si `requests` est absent, le script **ne casse pas** : la source réseau est
sautée et le socle `manual` (data/wc-teams.json) est tout de même produit.

## Usage

```bash
python docs/script/enrich_players.py                 # manual + TheSportsDB
python docs/script/enrich_players.py --no-thesportsdb   # socle seul (rapide, déterministe)
python docs/script/enrich_players.py --use-api-football  # + caps/buts/cartons (clé requise)
USE_TRANSFERMARKT=true python docs/script/enrich_players.py   # expérimental, à la main
```

## Sources & feature flags

| Flag | Défaut | Source | Apporte |
|---|---|---|---|
| `USE_THESPORTSDB` | `true` | TheSportsDB free tier | club, âge (free tier **très** limité, rate-limit 429 fréquent) |
| `USE_API_FOOTBALL` | `false` | API-Football (`API_FOOTBALL_KEY`) | caps, buts, cartons, âge fiable |
| `USE_TRANSFERMARKT` | `false` | Transfermarkt | **EXPÉRIMENTAL / ponctuel uniquement** |
| (socle) | toujours | `data/wc-teams.json` | nom, sélection, poste, club — garantit une sortie |

**Priorité de fusion** : `manual` → `thesportsdb` → `api_football` →
`transfermarkt`. La 1ʳᵉ source non nulle gagne le champ ; les suivantes ne
font que **combler les trous**, jamais écraser. `source` trace cumulativement
les providers ayant contribué (ex. `manual+thesportsdb`).

### Règles Transfermarkt (à respecter)

- **Jamais** en live ni en scraping fréquent. Enrichissement statique/manuel
  uniquement, si la donnée est déjà disponible.
- Off par défaut. Ne pas exécuter en boucle, ne pas contourner de protection.
- Respecter `robots.txt` / CGU. User-Agent explicite. Délai entre requêtes.
- Pour un effectif complet ponctuel, préférer `scrape_wc2026.py` (déjà
  robuste : retry, back-off, délai aléatoire), lancé **à la main**.

## Garanties de robustesse

- Chaque source est isolée (`try/except`) : une source qui échoue → log +
  on continue. Le script ne casse jamais.
- Sortie écrite même si 0 joueur (trace).
- Sortie **UTF-8** strict (`ensure_ascii=False`) — vérifié : 0 caractère de
  remplacement U+FFFD (cf. incident quiz : ne jamais faire transiter de
  l'accentué par un argument CLI Windows).
- Logs sur `stderr` (les `é` peuvent s'afficher `�` dans la console Windows :
  **cosmétique**, le fichier de sortie est correct).

## Format JSON produit

```json
{
  "source": "manual+thesportsdb",
  "generated_at": "2026-05-19T....Z",
  "team_count": 59,
  "player_count": 2595,
  "players": [
    {
      "name": "Kylian Mbappé",
      "country": "France",
      "position": "Forward",
      "club": "Real Madrid",
      "age": null,
      "caps": null,
      "goals": null,
      "yellow_cards": null,
      "red_cards": null,
      "substitutions_in": null,
      "substitutions_out": null,
      "source": "manual",
      "source_url": null,
      "retrieved_at": "2026-05-19T....Z"
    }
  ]
}
```

`position` est normalisée en 4 buckets stables : `Goalkeeper` / `Defender` /
`Midfielder` / `Forward` (depuis le FR détaillé du socle ou l'EN des APIs).

---

## Tables Supabase futures (proposition)

À créer **plus tard**, après vérification manuelle du JSON. Schéma proposé :

### `national_teams`
| colonne | type | note |
|---|---|---|
| `id` | uuid PK | `default uuid_generate_v4()` |
| `name` | text | nom FR (ex. « France ») |
| `country_code` | text | ISO (ex. `FR`) |
| `flag` | text | emoji ou URL |
| `source` | text | provider |
| `external_id` | text | id côté provider (nullable) |

### `players`
| colonne | type | note |
|---|---|---|
| `id` | uuid PK | |
| `name` | text not null | |
| `country` | text | sélection (ou FK `national_teams`) |
| `position` | text | bucket normalisé |
| `club` | text | |
| `birth_date` | date | nullable |
| `age` | int | nullable (dérivable de `birth_date`) |
| `source` | text | |
| `external_id` | text | nullable, unique par source |

### `player_national_stats`
| colonne | type | note |
|---|---|---|
| `id` | uuid PK | |
| `player_id` | uuid FK → `players.id` | |
| `team_id` | uuid FK → `national_teams.id` | |
| `caps` | int | nullable |
| `goals` | int | nullable |
| `yellow_cards` | int | nullable |
| `red_cards` | int | nullable |
| `substitutions_in` | int | nullable |
| `substitutions_out` | int | nullable |
| `source` | text | |
| `updated_at` | timestamptz | `default now()` |

> Import recommandé : script Node/SQL séparé lisant
> `output/players_worldcup_2026.json` → upsert idempotent par
> `(source, external_id)` ou `(country, name)`. **Ne jamais** passer
> l'accentué via argv Windows (utiliser `migrate.js --file`).

## Pistes d'amélioration

- Mapping FR→EN des sélections (réutiliser `lib/football/team-names.ts`)
  pour fiabiliser le matching TheSportsDB / API-Football.
- API-Football : compléter `/players?team=&season=` pour caps/buts/cartons.
- Cache disque des réponses réseau (éviter de retaper les APIs en dev).
