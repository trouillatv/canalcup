#!/usr/bin/env python3
"""
enrich_transfermarkt_selection_stats.py

Enrichit les effectifs WC2026 (data/wc-teams.json) avec des stats de
SÉLECTION NATIONALE (sélections/caps, buts en sélection, cartons si dispo,
âge) récupérées sur Transfermarkt.

⚠️  Outil HORS-LIGNE. Jamais appelé par l'app / le frontend / une route
    Next.js. Destiné à un cron EXTERNE (GitHub Actions, cron OS, VPS).

DEUX MODES
    --mode one-shot     Enrichit TOUS les effectifs (à lancer 1 fois avant
                        le tournoi, puis validation manuelle).
    --mode incremental  Pour la Coupe : lit la table Supabase `matches`,
                        détecte les matchs terminés, ré-enrichit UNIQUEMENT
                        les 2 sélections concernées si nécessaire.

ENTRÉE
    data/wc-teams.json                       (jamais modifié in place)

SORTIES (docs/script/output/)
    wc-teams-enriched.json                   structure source + champs stats
    selection-stats-report.json              rapport du run (found/ko/erreurs)
    enrichment-state.json                    suivi anti-doublon persistant
    ../cache/<hash>.html                     cache HTML local (gitignored)

RÈGLES TRANSFERMARKT (strictes)
    - Pas de live, pas de boucle fréquente, pas d'appel depuis l'app.
    - User-Agent applicatif honnête (PAS un bot IA — robots.txt interdit
      ClaudeBot/anthropic-ai/GPTBot/wget).
    - robots.txt respecté (urllib.robotparser + skip des Disallow connus).
    - Délai entre requêtes, retry léger, timeout, cache, reprenable.
    - Si une page échoue : on logue, on ignore proprement, on ne casse JAMAIS.

DÉPENDANCES
    pip install requests beautifulsoup4 lxml
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import random
import re
import sys
import time
import unicodedata
import urllib.robotparser
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

LOG = logging.getLogger("enrich_tm")

# ── Chemins ──────────────────────────────────────────────────────────────────
SCRIPT_DIR = Path(__file__).resolve().parent          # docs/script
REPO_ROOT = SCRIPT_DIR.parent.parent
SOURCE_JSON = REPO_ROOT / "data" / "wc-teams.json"
ENV_FILE = REPO_ROOT / ".env.local"
OUTPUT_DIR = SCRIPT_DIR / "output"
CACHE_DIR = SCRIPT_DIR / "cache"
ENRICHED_JSON = OUTPUT_DIR / "wc-teams-enriched.json"
REPORT_JSON = OUTPUT_DIR / "selection-stats-report.json"
STATE_JSON = OUTPUT_DIR / "enrichment-state.json"

# ── Transfermarkt / HTTP ─────────────────────────────────────────────────────
TM_BASE = "https://www.transfermarkt.com"
# UA applicatif explicite et honnête (ni bot IA, ni wget — interdits robots.txt).
USER_AGENT = (
    "CanalCup-SelectionStats/1.0 (enrichissement statique interne RSE Canal+; "
    "non commercial; contact: equipe Canal Cup)"
)
HTTP_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml",
}
DEFAULT_DELAY = (4.0, 7.0)   # secondes aléatoires entre 2 requêtes
MAX_RETRIES = 2              # retry LÉGER (le user veut un script poli)
TIMEOUT = 25
ROBOTS_URL = f"{TM_BASE}/robots.txt"
# Préfixes interdits par robots.txt (garde-fou en plus de robotparser).
ROBOTS_HARD_DISALLOW = ("/ceapi", "/quickselect", "/jumplist",
                        "/navigation/getSubNavigation")

# Intervalle min entre 2 enrichissements d'une même équipe (mode incremental).
MIN_REENRICH_HOURS = 6


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: Optional[datetime] = None) -> str:
    return (dt or _now()).isoformat()


def strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn"
    )


def norm(s: str) -> str:
    """Clé de rapprochement de noms : sans accents, minuscule, alphanum."""
    return re.sub(r"[^a-z0-9 ]", "", strip_accents(s or "").lower()).strip()


# ── .env.local (SUPABASE_PAT + ref) — comme scripts/migrate.js ───────────────
def load_env() -> None:
    if not ENV_FILE.exists():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k = k.strip()
        if k and k not in os.environ:
            os.environ[k] = v.strip().strip('"').strip("'")


def supabase_ref() -> Optional[str]:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    m = re.match(r"https://([^.]+)\.", url)
    return m.group(1) if m else None


# ── Table de correspondance nom FR → requête de recherche TM ─────────────────
# Réutilise la liste éprouvée de scrape_wc2026.py si dispo (DRY), sinon repli.
def build_team_query_map() -> dict[str, str]:
    qmap: dict[str, str] = {}
    try:
        sys.path.insert(0, str(SCRIPT_DIR))
        import scrape_wc2026  # noqa: WPS433 (réutilisation interne assumée)

        for name_fr, _group, query in getattr(scrape_wc2026, "TEAMS", []):
            qmap[norm(name_fr)] = query
        LOG.debug("Carte de requêtes TM réutilisée depuis scrape_wc2026 (%d)", len(qmap))
    except Exception as exc:  # import KO → on se rabat sur le nom de l'équipe
        LOG.warning("scrape_wc2026 non importable (%s) — requêtes = nom FR", exc)
    return qmap


# ── Couche HTTP polie : robots + cache + retry + délai ───────────────────────
class Fetcher:
    def __init__(self, delay: tuple[float, float], use_cache: bool, refresh: bool):
        import requests  # import tardif : déps seulement si on scrape vraiment

        self._requests = requests
        self.session = requests.Session()
        self.session.headers.update(HTTP_HEADERS)
        self.delay = delay
        self.use_cache = use_cache
        self.refresh = refresh
        self._last_request_at = 0.0
        self.rp = urllib.robotparser.RobotFileParser()
        self._init_robots()
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def _init_robots(self) -> None:
        try:
            self.rp.set_url(ROBOTS_URL)
            self.rp.read()
            LOG.info("robots.txt chargé : %s", ROBOTS_URL)
        except Exception as exc:
            LOG.warning("robots.txt illisible (%s) — on applique le garde-fou statique", exc)
            self.rp = None  # type: ignore[assignment]

    def allowed(self, url: str) -> bool:
        path = url[len(TM_BASE):] if url.startswith(TM_BASE) else url
        if any(path.startswith(p) for p in ROBOTS_HARD_DISALLOW):
            return False
        if self.rp is not None:
            try:
                return self.rp.can_fetch(USER_AGENT, url)
            except Exception:
                return True
        return True

    def _cache_path(self, url: str) -> Path:
        h = hashlib.sha256(url.encode("utf-8")).hexdigest()[:24]
        return CACHE_DIR / f"{h}.html"

    def get_soup(self, url: str):
        """Renvoie un BeautifulSoup ou None. Ne lève jamais."""
        from bs4 import BeautifulSoup

        if not self.allowed(url):
            LOG.warning("robots.txt interdit : %s — sauté", url)
            return None

        cache_file = self._cache_path(url)
        if self.use_cache and not self.refresh and cache_file.exists():
            LOG.debug("cache hit %s", url)
            try:
                return BeautifulSoup(cache_file.read_text(encoding="utf-8"), "lxml")
            except Exception:
                pass  # cache corrompu → on refetch

        # Délai poli (espace les requêtes même si retries).
        wait = random.uniform(*self.delay)
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < wait:
            time.sleep(wait - elapsed)

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                r = self.session.get(url, timeout=TIMEOUT)
                self._last_request_at = time.monotonic()
                if r.status_code == 200:
                    if self.use_cache:
                        try:
                            cache_file.write_text(r.text, encoding="utf-8")
                        except Exception:
                            pass
                    return BeautifulSoup(r.text, "lxml")
                if r.status_code in (403, 429):
                    LOG.warning("HTTP %s sur %s (tentative %d) — TM bloque "
                                "probablement cette IP", r.status_code, url, attempt)
                    time.sleep(15 * attempt)
                    continue
                LOG.warning("HTTP %s sur %s", r.status_code, url)
                return None
            except Exception as exc:
                LOG.warning("Erreur réseau (%s) sur %s", type(exc).__name__, url)
                time.sleep(5 * attempt)
        LOG.error("Échec après %d tentatives : %s", MAX_RETRIES, url)
        return None


# ── Résolution équipe → page kader ───────────────────────────────────────────
def resolve_kader_url(fetcher: Fetcher, query: str) -> Optional[str]:
    """
    Cherche la sélection sur TM, renvoie l'URL kader (effectif détaillé).

    Logique éprouvée (cf. scrape_wc2026.py) : pour une requête = nom de pays,
    la sélection nationale est le 1ᵉʳ lien /verein/ de la box dont l'en-tête
    contient « clubs ». Prendre le 1ᵉʳ /verein/ de n'importe quelle box mène
    à un club homonyme (ex. « France » → Inter Milan). Repli prudent ensuite.
    """
    soup = fetcher.get_soup(
        f"{TM_BASE}/schnellsuche/ergebnis/schnellsuche?query={query}"
    )
    if not soup:
        return None
    boxes = soup.select("div.box")

    def first_verein(box) -> Optional[str]:
        link = box.select_one('a[href*="/verein/"]')
        if not link or not link.get("href"):
            return None
        m = re.match(r"^/([^/]+)/[^/]+/verein/(\d+)", link["href"])
        if not m:
            return None
        slug, tm_id = m.group(1), m.group(2)
        return f"{TM_BASE}/{slug}/kader/verein/{tm_id}/saison_id/2025/plus/1"

    # 1) box dont l'en-tête contient « clubs » (cas nominal : sélection nat.)
    for box in boxes:
        header = box.find(["h2", "h3"])
        if header and "clubs" in header.get_text(strip=True).lower():
            url = first_verein(box)
            if url:
                return url
    # 2) repli : 1re box exposant un /verein/ (si le libellé du titre change)
    for box in boxes:
        url = first_verein(box)
        if url:
            return url
    return None


def parse_kader_players(soup) -> list[dict[str, str]]:
    """Liste {name, profile_url} depuis une page kader. Tolérant."""
    out: list[dict[str, str]] = []
    table = soup.select_one("table.items")
    if not table:
        return out
    for row in table.select("tbody > tr"):
        classes = row.get("class") or []
        if not any(c in classes for c in ("odd", "even")):
            continue
        link = (row.select_one("td.posrela a.spielprofil_tooltip")
                or row.select_one(".hauptlink a")
                or row.select_one('a[href*="/profil/spieler/"]'))
        if not link or not link.get("href"):
            continue
        name = link.get_text(strip=True)
        href = link["href"]
        if name and "/profil/spieler/" in href:
            out.append({"name": name, "profile_url": TM_BASE + href})
    return out


# ── Extraction stats sélection depuis la fiche joueur ────────────────────────
@dataclass
class SelStats:
    caps: Optional[int] = None
    goals: Optional[int] = None
    yellow_cards: Optional[int] = None
    red_cards: Optional[int] = None
    age: Optional[int] = None
    birth_date: Optional[str] = None   # ISO yyyy-mm-dd
    source_url: Optional[str] = None


def parse_player_selection(soup, profile_url: str) -> SelStats:
    """
    Extraction ROBUSTE avec fallbacks (pas de sélecteur CSS unique fragile) :
      1) Bloc 'Current international' / 'Nationalmannschaft' de la fiche.
      2) Repli regex sur le texte de la page (Caps/Länderspiele + Goals/Tore).
      3) Âge via la table d'en-tête ('Age:' / 'Date of birth').
    Tout champ introuvable reste None. Ne lève jamais.
    """
    st = SelStats(source_url=profile_url)
    try:
        # 1) Structure réelle TM .com (vérifiée) :
        #    <li class="data-header__label">Caps/Goals:
        #       <a class="data-header__content">38</a> / <a ...>0</a></li>
        #    1ᵉʳ <a> = sélections (caps), 2ᵉ = buts en sélection.
        for li in soup.find_all("li", class_="data-header__label"):
            label = li.get_text(" ", strip=True)
            low = label.lower()
            if "caps/goals" in low:
                nums = [
                    int(re.search(r"\d+", a.get_text()).group())
                    for a in li.find_all("a")
                    if re.search(r"\d+", a.get_text())
                ]
                if len(nums) >= 2:
                    st.caps, st.goals = nums[0], nums[1]
                elif len(nums) == 1:
                    st.caps = nums[0]
                else:  # repli : "38 / 0" dans le texte du li
                    m = re.search(r"(\d+)\s*/\s*(\d+)", label)
                    if m:
                        st.caps, st.goals = int(m.group(1)), int(m.group(2))
        # Âge + date de naissance : structure réelle TM .com (vérifiée) :
        #   <span itemprop="birthDate">03/07/1995 (30)</span>
        # L'âge est le nombre entre parenthèses (le label « Date of birth/Age »
        # ne commence pas par "age" — d'où l'ancien bug).
        bd = soup.find("span", attrs={"itemprop": "birthDate"})
        if bd:
            btxt = bd.get_text(" ", strip=True)
            ma = re.search(r"\((\d{1,2})\)", btxt)
            if ma:
                st.age = int(ma.group(1))
            md = re.search(r"(\d{2})/(\d{2})/(\d{4})", btxt)
            if md:
                st.birth_date = f"{md.group(3)}-{md.group(2)}-{md.group(1)}"

        # 2) Repli global si la fiche n'a pas le bloc data-header attendu.
        if st.caps is None:
            page_txt = soup.get_text(" ", strip=True)
            m = re.search(r"Caps\s*/?\s*Goals?\s*:?\s*(\d+)\s*/\s*(\d+)",
                          page_txt, re.I)
            if m:
                st.caps, st.goals = int(m.group(1)), int(m.group(2))
    except Exception as exc:
        LOG.debug("parse fiche KO (%s) : %s", type(exc).__name__, profile_url)
    return st


# ── État persistant (anti-doublon) ───────────────────────────────────────────
def load_state() -> dict[str, Any]:
    if STATE_JSON.exists():
        try:
            return json.loads(STATE_JSON.read_text(encoding="utf-8"))
        except Exception:
            LOG.warning("state corrompu — réinitialisé")
    return {"teams": {}, "processed_match_ids": [], "updated_at": None}


def save_state(state: dict[str, Any]) -> None:
    state["updated_at"] = _iso()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    STATE_JSON.write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def team_recently_enriched(state: dict[str, Any], team: str) -> bool:
    rec = state["teams"].get(team)
    if not rec or not rec.get("last_enriched_at"):
        return False
    try:
        last = datetime.fromisoformat(rec["last_enriched_at"])
    except ValueError:
        return False
    return (_now() - last).total_seconds() < MIN_REENRICH_HOURS * 3600


# ── Enrichissement d'une équipe ──────────────────────────────────────────────
def enrich_team(
    fetcher: Fetcher,
    team: dict[str, Any],
    qmap: dict[str, str],
    report: dict[str, Any],
) -> int:
    """Enrichit en place les joueurs d'une équipe. Renvoie le nb enrichis."""
    tname = team.get("name", "?")
    query = qmap.get(norm(tname), tname)
    kader_url = resolve_kader_url(fetcher, query)
    if not kader_url:
        report["teams_failed"].append({"team": tname, "reason": "kader introuvable"})
        LOG.warning("[%s] page effectif TM introuvable (query=%s)", tname, query)
        return 0

    soup = fetcher.get_soup(kader_url)
    if not soup:
        report["teams_failed"].append({"team": tname, "reason": "kader inaccessible"})
        return 0

    tm_players = parse_kader_players(soup)
    tm_index = {norm(p["name"]): p for p in tm_players}
    enriched = 0

    for player in team.get("players", []) or []:
        pname = player.get("name", "")
        match = tm_index.get(norm(pname))
        if not match:
            # rapprochement souple : nom de famille
            last = norm(pname).split()[-1] if norm(pname) else ""
            match = next(
                (v for k, v in tm_index.items() if last and k.endswith(last)), None
            )
        if not match:
            report["players_not_found"].append({"team": tname, "player": pname})
            continue

        prof = fetcher.get_soup(match["profile_url"])
        if not prof:
            report["players_error"].append(
                {"team": tname, "player": pname, "reason": "fiche inaccessible"})
            continue

        st = parse_player_selection(prof, match["profile_url"])
        player["caps"] = st.caps
        player["selection_goals"] = st.goals
        player["selection_yellow_cards"] = st.yellow_cards
        player["selection_red_cards"] = st.red_cards
        if st.age is not None:
            player["age"] = st.age
        if st.birth_date is not None:
            player["birth_date"] = st.birth_date
        player["stats_source"] = "Transfermarkt"
        player["stats_source_url"] = st.source_url
        player["stats_updated_at"] = _iso()
        if st.caps is not None or st.goals is not None:
            enriched += 1
            report["players_found"] += 1
        else:
            report["players_partial"] += 1

    LOG.info("[%s] %d/%d joueurs enrichis (caps/buts)",
             tname, enriched, len(team.get("players", []) or []))
    return enriched


# ── Lecture des matchs terminés (Supabase Management API) ────────────────────
def fetch_finished_matches() -> list[dict[str, Any]]:
    """Lit `matches` (status='finished') via l'API Management. [] si indispo."""
    import requests

    pat = os.environ.get("SUPABASE_PAT")
    ref = supabase_ref()
    if not pat or not ref:
        LOG.error("SUPABASE_PAT / ref manquant — mode incremental impossible")
        return []
    try:
        resp = requests.post(
            f"https://api.supabase.com/v1/projects/{ref}/database/query",
            headers={"Authorization": f"Bearer {pat}",
                     "Content-Type": "application/json"},
            json={"query": "select id, team_a, team_b, status, starts_at "
                            "from public.matches where status = 'finished';"},
            timeout=TIMEOUT,
        )
        # L'API Management renvoie 201 Created sur /database/query (succès).
        if resp.status_code not in (200, 201):
            LOG.error("Supabase query HTTP %s", resp.status_code)
            return []
        data = resp.json()
        if isinstance(data, dict) and data.get("message"):
            LOG.error("Supabase query erreur : %s", data["message"])
            return []
        return data if isinstance(data, list) else []
    except Exception as exc:
        LOG.error("Lecture matches KO (%s)", type(exc).__name__)
        return []


# ── Pipeline ─────────────────────────────────────────────────────────────────
def load_source_teams() -> list[dict[str, Any]]:
    try:
        raw = json.loads(SOURCE_JSON.read_text(encoding="utf-8"))
    except Exception as exc:
        LOG.error("Lecture %s KO : %s", SOURCE_JSON, exc)
        return []
    return raw if isinstance(raw, list) else raw.get("teams", [])


def find_team(teams: list[dict[str, Any]], name: str) -> Optional[dict[str, Any]]:
    n = norm(name)
    for t in teams:
        if norm(t.get("name", "")) == n:
            return t
    # rapprochement souple
    for t in teams:
        if n and norm(t.get("name", "")).startswith(n[:6]):
            return t
    return None


def new_report() -> dict[str, Any]:
    return {
        "generated_at": _iso(),
        "mode": None,
        "teams_processed": [],
        "teams_failed": [],
        "players_found": 0,
        "players_partial": 0,
        "players_not_found": [],
        "players_error": [],
    }


def write_outputs(teams: list[dict[str, Any]], report: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    ENRICHED_JSON.write_text(
        json.dumps(teams, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    REPORT_JSON.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    LOG.info("Écrit : %s + %s", ENRICHED_JSON.name, REPORT_JSON.name)


def run_one_shot(fetcher, teams, qmap, state, report, limit, only_team):
    report["mode"] = "one-shot"
    targets = teams
    if only_team:
        t = find_team(teams, only_team)
        targets = [t] if t else []
    if limit:
        targets = targets[:limit]
    for team in targets:
        tname = team.get("name", "?")
        try:
            n = enrich_team(fetcher, team, qmap, report)
            state["teams"][tname] = {
                "last_enriched_at": _iso(),
                "last_source": "Transfermarkt",
                "players_enriched": n,
                "last_error": None,
            }
            report["teams_processed"].append(tname)
        except Exception as exc:  # garde-fou ultime : un échec n'arrête pas tout
            LOG.error("[%s] erreur inattendue : %s", tname, exc)
            state["teams"].setdefault(tname, {})["last_error"] = str(exc)
        save_state(state)
        write_outputs(teams, report)


def run_incremental(fetcher, teams, qmap, state, report):
    report["mode"] = "incremental"
    matches = fetch_finished_matches()
    LOG.info("Matchs terminés en base : %d", len(matches))
    processed = set(state.get("processed_match_ids", []))

    for mt in matches:
        mid = str(mt.get("id"))
        if mid in processed:
            continue
        involved = [mt.get("team_a"), mt.get("team_b")]
        for tn in involved:
            if not tn:
                continue
            team = find_team(teams, tn)
            if not team:
                report["teams_failed"].append(
                    {"team": tn, "reason": "absente de wc-teams.json"})
                continue
            tname = team["name"]
            if team_recently_enriched(state, tname):
                LOG.info("[%s] enrichie récemment — sautée", tname)
                continue
            try:
                n = enrich_team(fetcher, team, qmap, report)
                state["teams"][tname] = {
                    "last_enriched_at": _iso(),
                    "last_source": "Transfermarkt",
                    "players_enriched": n,
                    "last_match_id": mid,
                    "last_error": None,
                }
                report["teams_processed"].append(tname)
            except Exception as exc:
                LOG.error("[%s] erreur inattendue : %s", tname, exc)
                state["teams"].setdefault(tname, {})["last_error"] = str(exc)
            save_state(state)
            write_outputs(teams, report)
        processed.add(mid)
        state["processed_match_ids"] = sorted(processed)
        save_state(state)

    if not matches:
        LOG.info("Aucun match terminé (ou Supabase indispo) — rien à faire.")
        write_outputs(teams, report)
    save_state(state)  # toujours tracer le run (même no-op)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Enrichissement stats sélection (Transfermarkt, hors-ligne).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--mode", choices=["one-shot", "incremental"],
                        default="one-shot")
    parser.add_argument("--limit", type=int, default=None,
                        help="one-shot : n'enrichir que N équipes (test)")
    parser.add_argument("--team", default=None,
                        help="one-shot : une seule équipe (test)")
    parser.add_argument("--delay", type=float, default=None,
                        help="délai fixe (s) entre requêtes (défaut : 4-7 aléatoire)")
    parser.add_argument("--no-cache", action="store_true")
    parser.add_argument("--refresh", action="store_true",
                        help="ignore le cache et re-télécharge")
    parser.add_argument("-v", "--verbose", action="store_true")
    parser.add_argument("-q", "--quiet", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.ERROR if args.quiet else
              logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%H:%M:%S",
        stream=sys.stderr,
    )

    load_env()
    teams = load_source_teams()
    if not teams:
        LOG.error("Aucune équipe en entrée — abandon.")
        return 1
    LOG.info("Équipes source : %d | mode=%s", len(teams), args.mode)

    delay = (args.delay, args.delay) if args.delay else DEFAULT_DELAY
    try:
        fetcher = Fetcher(delay=delay, use_cache=not args.no_cache,
                          refresh=args.refresh)
    except ImportError as exc:
        LOG.error("Dépendances manquantes (%s). pip install requests "
                  "beautifulsoup4 lxml", exc)
        return 1

    qmap = build_team_query_map()
    state = load_state()
    report = new_report()

    if args.mode == "one-shot":
        run_one_shot(fetcher, teams, qmap, state, report,
                     args.limit, args.team)
    else:
        run_incremental(fetcher, teams, qmap, state, report)

    LOG.info("Terminé. found=%d partial=%d not_found=%d errors=%d",
             report["players_found"], report["players_partial"],
             len(report["players_not_found"]), len(report["players_error"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
