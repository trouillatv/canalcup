#!/usr/bin/env python3
"""
enrich_players.py — Prépare une base joueurs propre des sélections de la
Coupe du Monde 2026 pour enrichir Canal Cup (compos, quiz, "qui est ce
joueur", stats, affichage TV, match center).

PHILOSOPHIE
    - Aucun appel frontend, aucune intégration directe à l'app ici.
    - Produit un JSON intermédiaire vérifiable AVANT tout import Supabase.
    - Multi-sources avec feature flags. Ne casse JAMAIS si une source échoue
      (chaque source est isolée en try/except, on logue et on continue).
    - La source "manual" (data/wc-teams.json, déjà enrichie) sert de socle :
      même hors-ligne, le script produit une base exploitable.

SOURCES (par flag, défauts prudents)
    USE_THESPORTSDB     = true   (free tier, sans clé)
    USE_API_FOOTBALL    = false  (nécessite API_FOOTBALL_KEY)
    USE_TRANSFERMARKT   = false  (EXPÉRIMENTAL / ponctuel — JAMAIS en boucle)

    Transfermarkt : enrichissement statique/manuel uniquement. Pas de live,
    pas de scraping fréquent. User-Agent propre, délai entre requêtes,
    respect de robots.txt / CGU. Off par défaut, à n'activer qu'à la main.

USAGE
    python docs/script/enrich_players.py
    python docs/script/enrich_players.py --use-api-football
    USE_TRANSFERMARKT=true python docs/script/enrich_players.py --verbose

SORTIE
    docs/script/output/players_worldcup_2026.json

DÉPENDANCES
    - Chemin par défaut (manual + TheSportsDB) : `requests` (optionnel : si
      absent, TheSportsDB est sauté, le socle manual reste produit).
    - Transfermarkt expérimental : `beautifulsoup4` + `lxml` (lazy import).
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

LOG = logging.getLogger("enrich_players")

# ── Chemins ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent          # docs/script
REPO_ROOT = SCRIPT_DIR.parent.parent                  # racine du repo
TEAMS_JSON = REPO_ROOT / "data" / "wc-teams.json"     # socle "manual"
OUTPUT_DIR = SCRIPT_DIR / "output"
OUTPUT_FILE = OUTPUT_DIR / "players_worldcup_2026.json"

THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3"
API_FOOTBALL_BASE = "https://v3.football.api-sports.io"

HTTP_USER_AGENT = "CanalCup-Enrich/1.0 (interne RSE Canal+; contact: equipe Canal Cup)"
HTTP_TIMEOUT = 20
TRANSFERMARKT_DELAY = 5.0  # secondes entre 2 requêtes si scraping expérimental


# ── Schéma joueur normalisé ──────────────────────────────────────────────────
# Tout champ inconnu reste à None — on ne devine jamais une stat.
def empty_player() -> dict[str, Any]:
    return {
        "name": None,
        "country": None,         # sélection nationale
        "position": None,        # normalisée EN : Goalkeeper/Defender/Midfielder/Forward
        "club": None,
        "age": None,
        "caps": None,            # apparitions en sélection
        "goals": None,           # buts en sélection
        "yellow_cards": None,
        "red_cards": None,
        "substitutions_in": None,
        "substitutions_out": None,
        "source": None,          # provider ayant fourni la ligne
        "source_url": None,
        "retrieved_at": None,    # date de récupération (ISO 8601 UTC)
    }


# Normalisation de poste : FR détaillé (data/wc-teams.json) ou EN détaillé
# (TheSportsDB / API-Football) → 4 buckets stables.
_POSITION_BUCKET = {
    # Gardien
    "gardien": "Goalkeeper", "goalkeeper": "Goalkeeper", "keeper": "Goalkeeper",
    # Défenseurs
    "défenseur central": "Defender", "arrière gauche": "Defender",
    "arrière droit": "Defender", "défenseur": "Defender",
    "centre-back": "Defender", "left-back": "Defender", "right-back": "Defender",
    "defender": "Defender", "defence": "Defender",
    # Milieux
    "milieu défensif": "Midfielder", "milieu central": "Midfielder",
    "milieu offensif": "Midfielder", "milieu gauche": "Midfielder",
    "milieu droit": "Midfielder", "milieu": "Midfielder",
    "defensive midfield": "Midfielder", "central midfield": "Midfielder",
    "attacking midfield": "Midfielder", "left midfield": "Midfielder",
    "right midfield": "Midfielder", "midfielder": "Midfielder", "midfield": "Midfielder",
    # Attaquants
    "ailier gauche": "Forward", "ailier droit": "Forward",
    "avant-centre": "Forward", "soutien d'attaquant": "Forward",
    "left winger": "Forward", "right winger": "Forward",
    "centre-forward": "Forward", "second striker": "Forward",
    "forward": "Forward", "striker": "Forward", "winger": "Forward", "attack": "Forward",
}


def normalize_position(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    return _POSITION_BUCKET.get(raw.strip().lower(), raw.strip())


def age_from_birthdate(iso_date: Optional[str]) -> Optional[int]:
    """Calcule l'âge à partir d'une date 'YYYY-MM-DD'. None si invalide."""
    if not iso_date:
        return None
    try:
        born = datetime.strptime(iso_date[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None
    today = datetime.now(timezone.utc).date()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── HTTP optionnel (requests chargé en lazy) ─────────────────────────────────
def _get_json(url: str, headers: Optional[dict] = None) -> Optional[Any]:
    """GET JSON robuste. Renvoie None sur toute erreur (jamais d'exception)."""
    try:
        import requests  # lazy : le socle manual ne dépend de rien
    except ImportError:
        LOG.warning("module 'requests' absent — source réseau sautée (%s)", url)
        return None
    try:
        resp = requests.get(
            url,
            headers={"User-Agent": HTTP_USER_AGENT, **(headers or {})},
            timeout=HTTP_TIMEOUT,
        )
        if resp.status_code != 200:
            LOG.warning("HTTP %s sur %s", resp.status_code, url)
            return None
        return resp.json()
    except Exception as exc:  # réseau, JSON, timeout… on ne casse jamais
        LOG.warning("Échec requête (%s) : %s", type(exc).__name__, url)
        return None


# ── Source 1 : MANUAL — data/wc-teams.json (socle, toujours disponible) ──────
def load_team_list() -> list[dict[str, Any]]:
    """Charge la liste d'équipes (étape 1). Source de vérité unique du repo."""
    try:
        raw = json.loads(TEAMS_JSON.read_text(encoding="utf-8"))
    except FileNotFoundError:
        LOG.error("Liste d'équipes introuvable : %s", TEAMS_JSON)
        return []
    except json.JSONDecodeError as exc:
        LOG.error("data/wc-teams.json invalide : %s", exc)
        return []
    teams = raw if isinstance(raw, list) else raw.get("teams", [])
    LOG.info("Équipes chargées : %d", len(teams))
    return teams


def collect_manual(teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extrait les joueurs déjà enrichis du repo (nom/poste/club/sélection)."""
    out: list[dict[str, Any]] = []
    ts = _now_iso()
    for team in teams:
        country = team.get("name")
        for p in team.get("players", []) or []:
            row = empty_player()
            caps_val = p.get("caps")
            goals_val = p.get("selection_goals") or p.get("goals")
            row.update(
                name=p.get("name"),
                country=country,
                position=normalize_position(p.get("position")),
                club=p.get("club") or None,
                age=p.get("age") or None,
                caps=caps_val if caps_val != "" else None,
                goals=goals_val if goals_val not in ("", None) else None,
                source="manual",
                source_url=p.get("stats_source_url") or None,
                retrieved_at=ts,
            )
            if row["name"]:
                out.append(row)
    LOG.info("[manual] %d joueurs", len(out))
    return out


# ── Source 2 : TheSportsDB (free tier, sans clé) ─────────────────────────────
def collect_thesportsdb(teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Enrichit via TheSportsDB. Le free tier limite fortement les effectifs
    (lookup_all_players souvent réservé Patreon) : on tente, on logue, on
    n'échoue jamais. Renvoie ce qui est récupérable (souvent club/âge).
    """
    out: list[dict[str, Any]] = []
    ts = _now_iso()
    for team in teams:
        country = team.get("name")
        # Recherche d'équipe nationale par nom anglais si dispo, sinon FR.
        query = team.get("name_en") or team.get("name") or ""
        data = _get_json(f"{THESPORTSDB_BASE}/searchteams.php?t={query}")
        team_obj = (data or {}).get("teams") or []
        if not team_obj:
            LOG.debug("[tsdb] équipe non trouvée : %s", country)
            continue
        team_id = team_obj[0].get("idTeam")
        if not team_id:
            continue
        squad = _get_json(f"{THESPORTSDB_BASE}/lookup_all_players.php?id={team_id}")
        players = (squad or {}).get("player") or []
        for p in players:
            row = empty_player()
            row.update(
                name=p.get("strPlayer"),
                country=country,
                position=normalize_position(p.get("strPosition")),
                club=p.get("strTeam") or None,
                age=age_from_birthdate(p.get("dateBorn")),
                source="thesportsdb",
                source_url=p.get("strThumb") or None,
                retrieved_at=ts,
            )
            if row["name"]:
                out.append(row)
    LOG.info("[thesportsdb] %d joueurs", len(out))
    return out


# ── Source 3 : API-Football (clé requise) ────────────────────────────────────
def collect_api_football(teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    API-Football : seule source fiable pour caps/buts/cartons. Nécessite
    API_FOOTBALL_KEY. Sans clé : log + skip propre (jamais d'exception).
    Implémentation volontairement minimale et tolérante — à compléter selon
    le plan d'abonnement (endpoints /players/squads, /players?team=&season=).
    """
    key = os.environ.get("API_FOOTBALL_KEY")
    if not key:
        LOG.warning("[api-football] API_FOOTBALL_KEY absente — source sautée")
        return []
    out: list[dict[str, Any]] = []
    ts = _now_iso()
    headers = {"x-apisports-key": key}
    for team in teams:
        country = team.get("name")
        ext = team.get("external_id") or team.get("name_en") or team.get("name")
        data = _get_json(
            f"{API_FOOTBALL_BASE}/players/squads?team={ext}", headers=headers
        )
        squads = (data or {}).get("response") or []
        for squad in squads:
            for p in squad.get("players", []) or []:
                row = empty_player()
                row.update(
                    name=p.get("name"),
                    country=country,
                    position=normalize_position(p.get("position")),
                    age=p.get("age"),
                    source="api_football",
                    source_url=None,
                    retrieved_at=ts,
                )
                if row["name"]:
                    out.append(row)
    LOG.info("[api-football] %d joueurs", len(out))
    return out


# ── Source 4 : Transfermarkt (EXPÉRIMENTAL / ponctuel) ───────────────────────
def collect_transfermarkt(teams: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    EXPÉRIMENTAL. Désactivé par défaut. Enrichissement statique/manuel
    UNIQUEMENT. Ne pas exécuter en boucle, ne pas contourner de protection,
    respecter robots.txt / CGU. User-Agent explicite + délai entre requêtes.

    Pour un scraping d'effectifs complet, utiliser plutôt le script dédié
    docs/script/scrape_wc2026.py (déjà robuste). Ici on s'arrête volontairement
    à un stub poli : la collecte massive automatisée n'est pas l'objectif.
    """
    LOG.warning(
        "[transfermarkt] mode EXPÉRIMENTAL — désactivé par défaut. Pour un "
        "effectif complet, lancer docs/script/scrape_wc2026.py à la main."
    )
    try:
        import bs4  # noqa: F401  (lazy : déps seulement si réellement activé)
    except ImportError:
        LOG.warning("[transfermarkt] beautifulsoup4 absent — source sautée")
        return []
    # Délai poli même pour un stub, pour ancrer la bonne pratique.
    time.sleep(TRANSFERMARKT_DELAY)
    LOG.info("[transfermarkt] 0 joueur (stub volontaire, pas de scraping auto)")
    return []


# ── Fusion multi-sources ─────────────────────────────────────────────────────
def merge(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Dédoublonne par (country, name). La 1re source non nulle gagne le champ ;
    les sources suivantes ne font que COMBLER les trous (jamais écraser).
    Ordre d'appel = ordre de priorité.
    """
    merged: dict[tuple, dict[str, Any]] = {}
    fillable = [
        "position", "club", "age", "caps", "goals", "yellow_cards",
        "red_cards", "substitutions_in", "substitutions_out",
    ]
    for r in rows:
        key = ((r.get("country") or "").lower(), (r.get("name") or "").strip().lower())
        if not key[1]:
            continue
        if key not in merged:
            merged[key] = r
            continue
        cur = merged[key]
        for f in fillable:
            if cur.get(f) in (None, "") and r.get(f) not in (None, ""):
                cur[f] = r[f]
        # Trace cumulative des sources ayant contribué.
        if r.get("source") and r["source"] not in (cur.get("source") or ""):
            cur["source"] = f"{cur.get('source')}+{r['source']}"
    return list(merged.values())


# ── Pipeline ─────────────────────────────────────────────────────────────────
def run(flags: dict[str, bool]) -> dict[str, Any]:
    teams = load_team_list()
    rows: list[dict[str, Any]] = []
    used: list[str] = []

    # Ordre = priorité de fusion. manual d'abord (socle fiable du repo).
    rows += collect_manual(teams)
    if rows:
        used.append("manual")

    if flags["thesportsdb"]:
        try:
            tsdb = collect_thesportsdb(teams)
            if tsdb:
                rows += tsdb
                used.append("thesportsdb")
        except Exception as exc:  # garde-fou ultime
            LOG.error("[thesportsdb] erreur inattendue : %s", exc)

    if flags["api_football"]:
        try:
            apif = collect_api_football(teams)
            if apif:
                rows += apif
                used.append("api_football")
        except Exception as exc:
            LOG.error("[api-football] erreur inattendue : %s", exc)

    if flags["transfermarkt"]:
        try:
            tm = collect_transfermarkt(teams)
            if tm:
                rows += tm
                used.append("transfermarkt_experiment")
        except Exception as exc:
            LOG.error("[transfermarkt] erreur inattendue : %s", exc)

    players = merge(rows)
    players.sort(key=lambda p: ((p.get("country") or ""), (p.get("name") or "")))

    return {
        "source": "+".join(used) if used else "none",
        "generated_at": _now_iso(),
        "team_count": len(teams),
        "player_count": len(players),
        "players": players,
    }


def write_output(payload: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    LOG.info(
        "Écrit : %s (%d joueurs, sources=%s)",
        OUTPUT_FILE, payload["player_count"], payload["source"],
    )


def _flag(env_name: str, default: bool, cli_value: Optional[bool]) -> bool:
    if cli_value is not None:
        return cli_value
    raw = os.environ.get(env_name)
    if raw is None:
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Prépare la base joueurs WC2026 (JSON intermédiaire vérifiable).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--use-thesportsdb", dest="tsdb", action="store_true", default=None)
    parser.add_argument("--no-thesportsdb", dest="tsdb", action="store_false")
    parser.add_argument("--use-api-football", dest="apif", action="store_true", default=None)
    parser.add_argument("--use-transfermarkt", dest="tm", action="store_true", default=None,
                        help="EXPÉRIMENTAL — ponctuel/manuel uniquement")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-q", "--quiet", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.ERROR if args.quiet else logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )

    flags = {
        "thesportsdb": _flag("USE_THESPORTSDB", True, args.tsdb),
        "api_football": _flag("USE_API_FOOTBALL", False, args.apif),
        "transfermarkt": _flag("USE_TRANSFERMARKT", False, args.tm),
    }
    LOG.info("Flags : %s", flags)

    payload = run(flags)
    if payload["player_count"] == 0:
        LOG.error("Aucun joueur collecté — fichier tout de même écrit pour trace.")
    write_output(payload)
    return 0 if payload["player_count"] > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
