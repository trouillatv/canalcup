# Stats sélection — enrichissement Transfermarkt

`enrich_transfermarkt_selection_stats.py` — enrichit les effectifs WC2026
avec des **stats de sélection nationale** (sélections/caps, buts en
sélection, âge, date de naissance ; cartons si un jour dispo).

> ⚠️ Outil **hors-ligne**. Jamais appelé par l'app / le frontend / une
> route Next.js / un cron Vercel. Destiné à un **cron EXTERNE**.

> 🔗 Voir aussi `README.md` (script `enrich_players.py`, multi-sources).

## Deux modes

| Mode | Quand | Quoi |
|---|---|---|
| `--mode one-shot` | **avant** le tournoi, 1 fois | enrichit tous les effectifs, validation manuelle ensuite |
| `--mode incremental` | **pendant** la Coupe, via cron externe | lit `matches` Supabase, détecte les matchs finis, ré-enrichit **seulement** les 2 sélections concernées, anti-doublon |

```bash
pip install requests beautifulsoup4 lxml

# Pré-tournoi (long : ~2-3 h pour 59 équipes, mais caché + reprenable)
python docs/script/enrich_transfermarkt_selection_stats.py --mode one-shot

# Test rapide / ciblé
python docs/script/enrich_transfermarkt_selection_stats.py --mode one-shot --team France
python docs/script/enrich_transfermarkt_selection_stats.py --mode one-shot --limit 3 -v

# Pendant la Coupe (lancé par le cron externe)
python docs/script/enrich_transfermarkt_selection_stats.py --mode incremental
```

Flags : `--limit N`, `--team NOM`, `--delay S`, `--no-cache`, `--refresh`,
`-v/-q`.

## Entrée / sorties

| Fichier | Rôle | Commité ? |
|---|---|---|
| `data/wc-teams.json` | **entrée**, jamais modifié in place | oui (source) |
| `output/wc-teams-enriched.json` | structure source + champs stats | non (régénéré) |
| `output/selection-stats-report.json` | rapport run (found/partial/not_found/erreurs) | non |
| `output/enrichment-state.json` | suivi anti-doublon (last_enriched_at/équipe, match_id traités) | non |
| `cache/*.html` | cache HTML local (reprise sans rescraper) | non (gitignored) |

Champs ajoutés par joueur : `caps`, `selection_goals`,
`selection_yellow_cards`, `selection_red_cards`, `age`, `birth_date`,
`stats_source` (= `"Transfermarkt"`), `stats_source_url`,
`stats_updated_at`.

## Flux validation → promotion (option A retenue)

1. Lancer le script → `output/wc-teams-enriched.json`.
2. **Vérifier à la main** (rapport + échantillon de joueurs connus).
3. Si OK, **promouvoir** : remplacer `data/wc-teams.json` par le fichier
   enrichi (le script ne touche JAMAIS la source sans cette validation).
4. L'app lit `data/wc-teams.json` → la fiche équipe affiche l'onglet
   **« Stats sélection »** (`components/teams/WCTeamFiche.tsx`).

Tant que la promotion n'est pas faite, l'onglet dégrade proprement
(« enrichissement pas encore importé ») — l'app **ne dépend jamais** de
Transfermarkt ni du scraping.

## Cron externe (phase incremental, dès le 11/06)

Jamais Vercel/Next.js. **Workflow réel câblé** :
**`.github/workflows/enrich-selection.yml`** (cron horaire + déclenchement
manuel via l'onglet Actions). Calqué sur `update-squads.yml` :
`concurrency` (jamais 2 scrapes concurrents), garde-fou (promotion de
`data/wc-teams.json` seulement si JSON valide ≥ 50 équipes ET modifié,
sinon aucun commit), `actions/cache` pour persister cache HTML + état
anti-doublon entre runs éphémères, rapport en artefact.

**« Regarde les fins de matchs »** : toute la logique est dans le script —
il lit la table Supabase `matches` (`status='finished'`), prend les 2
sélections du match, anti-doublon via `enrichment-state.json`. Le cron
horaire ne fait que sonder assez souvent pour traiter un match < 1 h après
sa fin (densifiable en `*/30 * * * *`).

**Secrets repo à créer** (Settings → Secrets and variables → Actions) :
`SUPABASE_PAT`, `NEXT_PUBLIC_SUPABASE_URL`. Le script lit les matchs finis
via l'API Management Supabase (comme `scripts/migrate.js`).

Alternatives équivalentes si besoin : cron OS, VPS, tâche planifiée — même
commande `--mode incremental`.

## Conformité Transfermarkt (strict)

- robots.txt **respecté** : `urllib.robotparser` + skip des `Disallow`
  (`/ceapi`, `/quickselect`, `/jumplist`, `/navigation/getSubNavigation`).
- User-Agent **applicatif honnête** — **pas** un bot IA : robots.txt
  interdit explicitement `ClaudeBot`, `anthropic-ai`, `GPTBot`, `wget`.
- Délai aléatoire 4-7 s entre requêtes, retry **léger**, timeout, cache.
- One-shot/manuel ou incrémental ciblé — **jamais** live, jamais en boucle
  fréquente, jamais depuis l'app.
- Si une page échoue (403/429/Cloudflare/IP datacenter…) : log + on ignore
  proprement, on n'écrase rien, on ne casse jamais. Les IP serveur sont
  souvent challengées : préférer un runner résidentiel/GitHub.

## Robustesse du parsing

Basé sur la **structure réelle TM vérifiée**, pas des sélecteurs fragiles :

- `<li class="data-header__label">Caps/Goals: <a>38</a>/<a>0</a></li>`
  → 1ᵉʳ `<a>` = caps, 2ᵉ = buts ; repli regex `(\d+)\s*/\s*(\d+)`.
- `<span itemprop="birthDate">03/07/1995 (30)</span>` → âge = `(NN)`,
  `birth_date` = ISO. Repli texte global sinon.
- Résolution équipe : box dont l'en-tête contient « clubs » (sinon on
  tombe sur un club homonyme — bug évité, cf. « France » → Inter Milan).
- Tout champ introuvable reste `null`, jamais d'exception.

## Limites connues

- Cartons en sélection : **non exposés** par la fiche TM → restent `null`.
- Free/datacenter IP souvent bloquées par Cloudflare TM → lancer depuis un
  environnement adapté ; le script dégrade sans casser.

## Table Supabase future (phase B, plus tard)

Si l'option A (JSON statique) fonctionne bien, migrer vers les tables
proposées dans `README.md` (`national_teams`, `players`,
`player_national_stats`) — import via `scripts/migrate.js --file`
(jamais d'accent en argv).
