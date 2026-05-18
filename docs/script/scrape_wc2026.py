#!/usr/bin/env python3
"""
scrape_wc2026.py — Génère un CSV des effectifs des 48 équipes de la Coupe
du Monde de la FIFA 2026 (Canada / Mexique / USA, 11 juin – 19 juillet 2026).

Source : Transfermarkt (effectifs et valeurs marchandes à jour à l'instant
de l'exécution).

Sortie CSV (séparateur « ; ») :
    Selection;Groupe;Poste;Nom;Club (Pays);Valeur Marchande

Usage :
    python scrape_wc2026.py [--output wc2026.csv] [--quiet|--verbose]

Exemple CRON (mise à jour quotidienne à 4h du matin) :
    0 4 * * *  cd /opt/wc2026 && /usr/bin/python3 scrape_wc2026.py \\
                   --output wc2026_$(date +\\%Y\\%m\\%d).csv --quiet

Dépendances :
    pip install requests beautifulsoup4 lxml

Ce script n'utilise AUCUN ID Transfermarkt en dur : chaque équipe est
résolue dynamiquement via la recherche interne du site, ce qui le rend
robuste aux renumérotations.
"""
from __future__ import annotations

import argparse
import csv
import logging
import random
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional

import requests
from bs4 import BeautifulSoup

# ============================================================================
# Configuration
# ============================================================================

BASE = "https://www.transfermarkt.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/125.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml",
}

DELAY_RANGE = (3.0, 6.0)   # secondes aléatoires entre 2 requêtes
MAX_RETRIES = 3
TIMEOUT = 30               # secondes par requête HTTP

LOG = logging.getLogger("wc2026")


# ============================================================================
# Les 48 équipes qualifiées (confirmé après les barrages du 31 mars 2026)
# Format : (nom français, groupe, requête de recherche Transfermarkt)
# ============================================================================

TEAMS: list[tuple[str, str, str]] = [
    # Groupe A
    ("Mexique",             "A", "Mexico"),
    ("Afrique du Sud",      "A", "South Africa"),
    ("République de Corée", "A", "South Korea"),
    ("Tchéquie",            "A", "Czech Republic"),
    # Groupe B
    ("Canada",              "B", "Canada"),
    ("Bosnie-Herzégovine",  "B", "Bosnia-Herzegovina"),
    ("Qatar",               "B", "Qatar"),
    ("Suisse",              "B", "Switzerland"),
    # Groupe C
    ("Brésil",              "C", "Brazil"),
    ("Maroc",               "C", "Morocco"),
    ("Haïti",               "C", "Haiti"),
    ("Écosse",              "C", "Scotland"),
    # Groupe D
    ("États-Unis",          "D", "United States"),
    ("Paraguay",            "D", "Paraguay"),
    ("Australie",           "D", "Australia"),
    ("Turquie",             "D", "Turkey"),
    # Groupe E
    ("Allemagne",           "E", "Germany"),
    ("Curaçao",             "E", "Curaçao"),
    ("Côte d'Ivoire",       "E", "Ivory Coast"),
    ("Équateur",            "E", "Ecuador"),
    # Groupe F
    ("Pays-Bas",            "F", "Netherlands"),
    ("Japon",               "F", "Japan"),
    ("Suède",               "F", "Sweden"),
    ("Tunisie",             "F", "Tunisia"),
    # Groupe G
    ("Belgique",            "G", "Belgium"),
    ("Égypte",              "G", "Egypt"),
    ("RI Iran",             "G", "Iran"),
    ("Nouvelle-Zélande",    "G", "New Zealand"),
    # Groupe H
    ("Espagne",             "H", "Spain"),
    ("Cap-Vert",            "H", "Cape Verde"),
    ("Arabie saoudite",     "H", "Saudi Arabia"),
    ("Uruguay",             "H", "Uruguay"),
    # Groupe I
    ("France",              "I", "France"),
    ("Sénégal",             "I", "Senegal"),
    ("Irak",                "I", "Iraq"),
    ("Norvège",             "I", "Norway"),
    # Groupe J
    ("Argentine",           "J", "Argentina"),
    ("Algérie",             "J", "Algeria"),
    ("Autriche",            "J", "Austria"),
    ("Jordanie",            "J", "Jordan"),
    # Groupe K
    ("Portugal",            "K", "Portugal"),
    ("RD Congo",            "K", "DR Congo"),
    ("Ouzbékistan",         "K", "Uzbekistan"),
    ("Colombie",            "K", "Colombia"),
    # Groupe L
    ("Angleterre",          "L", "England"),
    ("Croatie",             "L", "Croatia"),
    ("Ghana",               "L", "Ghana"),
    ("Panama",              "L", "Panama"),
]


# ============================================================================
# Traductions FR (les valeurs Transfermarkt sont en anglais sur le .com)
# ============================================================================

POSITION_FR = {
    "Goalkeeper":          "Gardien",
    "Centre-Back":         "Défenseur central",
    "Left-Back":           "Arrière gauche",
    "Right-Back":          "Arrière droit",
    "Defensive Midfield":  "Milieu défensif",
    "Central Midfield":    "Milieu central",
    "Attacking Midfield":  "Milieu offensif",
    "Left Midfield":       "Milieu gauche",
    "Right Midfield":      "Milieu droit",
    "Left Winger":         "Ailier gauche",
    "Right Winger":        "Ailier droit",
    "Centre-Forward":      "Avant-centre",
    "Second Striker":      "Soutien d'attaquant",
}

COUNTRY_FR = {
    "England": "Angleterre",   "Spain": "Espagne",          "Italy": "Italie",
    "Germany": "Allemagne",    "France": "France",          "Portugal": "Portugal",
    "Netherlands": "Pays-Bas", "Belgium": "Belgique",       "Turkey": "Turquie",
    "Türkiye": "Turquie",      "Saudi Arabia": "Arabie saoudite",
    "United States": "États-Unis", "USA": "États-Unis",     "Mexico": "Mexique",
    "Brazil": "Brésil",        "Argentina": "Argentine",    "Greece": "Grèce",
    "Scotland": "Écosse",      "Austria": "Autriche",       "Switzerland": "Suisse",
    "Denmark": "Danemark",     "Sweden": "Suède",           "Norway": "Norvège",
    "Russia": "Russie",        "Ukraine": "Ukraine",        "Croatia": "Croatie",
    "Czech Republic": "Tchéquie", "Poland": "Pologne",      "Japan": "Japon",
    "China": "Chine",          "South Korea": "Corée du Sud",
    "United Arab Emirates": "Émirats arabes unis", "Qatar": "Qatar",
    "Egypt": "Égypte",         "Morocco": "Maroc",          "Tunisia": "Tunisie",
    "Algeria": "Algérie",      "Senegal": "Sénégal",        "Ivory Coast": "Côte d'Ivoire",
    "Ghana": "Ghana",          "Australia": "Australie",    "Canada": "Canada",
    "Colombia": "Colombie",    "Uruguay": "Uruguay",        "Paraguay": "Paraguay",
    "Iran": "Iran",            "Iraq": "Irak",              "Jordan": "Jordanie",
    "Uzbekistan": "Ouzbékistan", "South Africa": "Afrique du Sud",
    "New Zealand": "Nouvelle-Zélande", "Curaçao": "Curaçao", "Cape Verde": "Cap-Vert",
    "Bosnia-Herzegovina": "Bosnie-Herzégovine", "Haiti": "Haïti",
    "Ecuador": "Équateur",     "Panama": "Panama",          "DR Congo": "RD Congo",
    "Romania": "Roumanie",     "Bulgaria": "Bulgarie",      "Serbia": "Serbie",
    "Hungary": "Hongrie",      "Slovakia": "Slovaquie",     "Slovenia": "Slovénie",
    "Cyprus": "Chypre",        "Israel": "Israël",          "Wales": "Pays de Galles",
    "Northern Ireland": "Irlande du Nord", "Ireland": "Irlande",
    "Scotland": "Écosse",
}

translate_position = lambda en: POSITION_FR.get(en.strip(), en.strip())
translate_country  = lambda en: COUNTRY_FR.get(en.strip(), en.strip())


# ============================================================================
# Modèle de données
# ============================================================================

@dataclass
class Player:
    selection: str
    group: str
    position: str
    name: str
    club: str
    club_country: str
    market_value: str


# ============================================================================
# Couche HTTP — retry + back-off + délai aléatoire
# ============================================================================

def make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def http_get(session: requests.Session, url: str) -> Optional[BeautifulSoup]:
    """GET avec retry, back-off exponentiel et délai aléatoire."""
    for attempt in range(1, MAX_RETRIES + 1):
        time.sleep(random.uniform(*DELAY_RANGE))
        try:
            r = session.get(url, timeout=TIMEOUT)
            if r.status_code == 200:
                return BeautifulSoup(r.text, "lxml")
            if r.status_code in (403, 429):
                wait = 30 * attempt
                LOG.warning("HTTP %s sur %s — pause %ss", r.status_code, url, wait)
                time.sleep(wait)
                continue
            LOG.warning("HTTP %s sur %s", r.status_code, url)
        except requests.RequestException as exc:
            LOG.warning("Erreur réseau (%s) sur %s", exc, url)
        time.sleep(5 * attempt)
    LOG.error("Échec après %d tentatives : %s", MAX_RETRIES, url)
    return None


# ============================================================================
# Résolution d'URL d'équipe via la recherche Transfermarkt
# ============================================================================

def find_team_url(session: requests.Session, query: str) -> Optional[str]:
    """
    Cherche une équipe nationale sur Transfermarkt et renvoie l'URL de la
    page « kader » (effectif détaillé). Repose sur le moteur de recherche
    interne, donc pas d'ID en dur.
    """
    search_url = f"{BASE}/schnellsuche/ergebnis/schnellsuche?query={query}"
    soup = http_get(session, search_url)
    if not soup:
        return None

    # Transfermarkt ne sépare plus les sélections : elles figurent dans la
    # box « Search results: Clubs » et la sélection nationale est le 1er
    # résultat /verein/ pour une requête = nom de pays (vérifié sur de
    # multiples nations : FRA 3377, GER 3262, BRA 3439, JPN 3435, USA 3505…).
    boxes = soup.select("div.box")

    def first_verein(box) -> Optional[str]:
        link = box.select_one('a[href*="/verein/"]')
        if not link or not link.get("href"):
            return None
        m = re.match(r"^/([^/]+)/[^/]+/verein/(\d+)", link["href"])
        if not m:
            return None
        slug, tm_id = m.group(1), m.group(2)
        return f"{BASE}/{slug}/kader/verein/{tm_id}/saison_id/2025/plus/1"

    # 1) box dont le titre contient « clubs » (cas nominal actuel)
    for box in boxes:
        header = box.find(["h2", "h3"])
        if header and "clubs" in header.get_text(strip=True).lower():
            url = first_verein(box)
            if url:
                return url

    # 2) repli : 1re box exposant un lien /verein/ (robustesse si le libellé
    #    du titre change encore)
    for box in boxes:
        url = first_verein(box)
        if url:
            return url
    return None


# ============================================================================
# Parsing d'une page kader (effectif)
# ============================================================================

def parse_squad(soup: BeautifulSoup, selection: str, group: str) -> list[Player]:
    """Extrait tous les joueurs présents dans le tableau d'effectif."""
    players: list[Player] = []
    table = soup.select_one("table.items")
    if not table:
        LOG.warning("Pas de table 'items' pour %s", selection)
        return players

    for row in table.select("tbody > tr"):
        classes = row.get("class") or []
        if not any(c in classes for c in ("odd", "even")):
            continue

        # --- Nom du joueur ---
        name_link = row.select_one("td.posrela a.spielprofil_tooltip") \
                    or row.select_one(".hauptlink a")
        name = name_link.get_text(strip=True) if name_link else ""
        if not name:
            continue

        # --- Poste (sous le nom dans une inline-table) ---
        position_en = ""
        inline = row.select_one("table.inline-table")
        if inline:
            trs = inline.find_all("tr")
            if len(trs) >= 2:
                tds = trs[-1].find_all("td")
                if tds:
                    position_en = tds[-1].get_text(strip=True)

        # --- Club : cellule contenant un lien /verein/ (le logo n'a plus de
        #     classe 'tiny_wappen'). Nom via title/alt de l'image, sinon
        #     texte du lien. ---
        club = ""
        club_link = row.select_one('td a[href*="/verein/"]')
        if club_link:
            club_img = club_link.find("img")
            if club_img:
                club = (club_img.get("title") or club_img.get("alt") or "").strip()
            if not club:
                club = club_link.get_text(strip=True)

        # --- Pays du club : drapeau dans la même cellule si présent ---
        club_country = ""
        if club_link:
            parent_td = club_link.find_parent("td")
            if parent_td:
                flag = parent_td.find("img", class_="flaggenrahmen")
                if flag:
                    club_country = (flag.get("title") or flag.get("alt") or "").strip()

        # --- Valeur marchande (dernière cellule alignée à droite) ---
        mv_cell = row.select_one("td.rechts.hauptlink") or row.select("td.rechts")
        if isinstance(mv_cell, list):
            mv_cell = mv_cell[-1] if mv_cell else None
        market_value = mv_cell.get_text(strip=True) if mv_cell else "-"

        players.append(Player(
            selection=selection,
            group=group,
            position=translate_position(position_en),
            name=name,
            club=club or "Sans club",
            club_country=translate_country(club_country) if club_country else "",
            market_value=market_value or "-",
        ))

    return players


# ============================================================================
# Pipeline principal
# ============================================================================

def iter_players(session: requests.Session) -> Iterator[Player]:
    total_teams = len(TEAMS)
    for idx, (name_fr, group, query) in enumerate(TEAMS, 1):
        LOG.info("[%d/%d] %s (Groupe %s)", idx, total_teams, name_fr, group)
        kader_url = find_team_url(session, query)
        if not kader_url:
            LOG.error("URL introuvable pour %s (query='%s')", name_fr, query)
            continue
        LOG.debug("       %s", kader_url)
        soup = http_get(session, kader_url)
        if not soup:
            continue
        players = parse_squad(soup, name_fr, group)
        LOG.info("       %d joueurs", len(players))
        yield from players


def write_csv(players: list[Player], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";", quoting=csv.QUOTE_MINIMAL)
        w.writerow(["Selection", "Groupe", "Poste", "Nom",
                    "Club (Pays)", "Valeur Marchande"])
        for p in players:
            club_field = f"{p.club} ({p.club_country})" if p.club_country else p.club
            w.writerow([p.selection, p.group, p.position, p.name,
                        club_field, p.market_value])


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Scraper Transfermarkt → CSV des effectifs du Mondial 2026",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("-o", "--output", default="wc2026_squads.csv",
                        help="fichier CSV de sortie (défaut : %(default)s)")
    parser.add_argument("-q", "--quiet", action="store_true",
                        help="ne logger que les erreurs (utile en CRON)")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="logs détaillés (debug)")
    args = parser.parse_args(argv)

    level = logging.ERROR if args.quiet else \
            logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-7s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        stream=sys.stderr,
    )

    out = Path(args.output)
    LOG.info("Scraping des 48 équipes de la Coupe du Monde 2026…")
    LOG.info("Sortie : %s", out.resolve())

    session = make_session()
    players = list(iter_players(session))

    LOG.info("Total collecté : %d joueurs sur %d équipes",
             len(players), len(TEAMS))
    if not players:
        LOG.error("Aucun joueur récupéré — rien à écrire.")
        return 1

    write_csv(players, out)
    LOG.info("CSV écrit : %s (%d lignes)", out, len(players))
    return 0


if __name__ == "__main__":
    sys.exit(main())
