// ─────────────────────────────────────────────────────────────────────────────
//  wc-csv-to-json.js
//  Transforme le CSV produit par docs/script/scrape_wc2026.py
//  (Selection;Groupe;Poste;Nom;Club (Pays);Valeur Marchande)
//  et MERGE les effectifs dans data/wc-teams.json :
//    - remplace UNIQUEMENT players[] de chaque équipe matchée
//    - conserve group / squadValue / form / nextMatch / recentScores /
//      calendar (issus de docs/*.txt — le scraper ne les fournit pas)
//
//  Garde-fou anti-écrasement (un scrape Transfermarkt cassé renvoie des
//  équipes vides EN SILENCE) :
//    - une équipe doit avoir ≥ MIN_PLAYERS joueurs pour être prise en compte
//    - au moins MIN_TEAMS équipes valides, sinon ABORT sans rien écrire
//    - on ne régresse jamais une équipe (si le nouveau total < 50 % de
//      l'ancien, on garde l'ancien effectif et on warn)
//
//  Usage : node scripts/wc-csv-to-json.js <csv> [--out data/wc-teams.json]
//  Exit  : 0 = écrit (ou rien à changer) · 1 = garde-fou déclenché / erreur
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DEFAULT_OUT = path.join(ROOT, "data", "wc-teams.json");
const INDEX_OUT = path.join(ROOT, "data", "wc-teams-index.json");

const MIN_PLAYERS = 11; // une sélection a ≥ 23 ; < 11 = scrape cassé
const MIN_TEAMS = 35; // sous ce seuil de sélections valides → on n'écrit rien

function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// Noms du scraper (TEAMS python) dont le slug ≠ slug de data/wc-teams.json.
const SLUG_ALIASES = {
  "republique-de-coree": "coree-du-sud",
  "ri-iran": "iran",
};
const canonicalSlug = (sel) => {
  const s = slugify(sel);
  return SLUG_ALIASES[s] || s;
};

// ── Appariement de noms (effectif API-Football abrégé « M. Maignan » ↔ scrape
//    TM nom complet « Mike Maignan ») — même logique que backfill-tm-values.js.
const COMBINING = /[̀-ͯ]/g;
function normName(s) {
  return String(s || "").normalize("NFD").replace(COMBINING, "").replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, " ").trim().toLowerCase();
}
const PARTICLES = new Set(["de", "del", "della", "di", "da", "dos", "van", "von", "der",
  "den", "la", "le", "el", "al", "bin", "ben", "mc", "mac", "san", "st"]);
function surnameOf(n) {
  const t = n.split(" ").filter(Boolean);
  if (t.length <= 1) return n;
  let i = t.length - 1;
  while (i - 1 >= 1 && PARTICLES.has(t[i - 1])) i--;
  return t.slice(i).join(" ");
}
function initialOf(n) { return (n.split(" ").filter(Boolean)[0] || "").charAt(0); }
function tokenSetKey(n) { return n.split(" ").filter(Boolean).sort().join(" "); }
function cleanClub(raw) {
  if (!raw) return null;
  const c = String(raw).replace(/\s*\([^)]*\)\s*$/, "").trim(); // retire « (Pays) »
  return c && c !== "Sans club" ? c : null;
}
function cleanValue(raw) {
  const v = String(raw || "").trim();
  return v && v !== "-" ? v : null;
}

function parseCsv(file) {
  const lines = fs
    .readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    console.error(`✗ CSV vide ou sans données : ${file}`);
    process.exit(1);
  }

  // En-tête attendu : Selection;Groupe;Poste;Nom;Club (Pays);Valeur Marchande
  const bySlug = new Map(); // slug → [{name,position,club,value}]
  for (const line of lines.slice(1)) {
    const c = line.split(";").map((x) => x.trim());
    const [selection, , poste, nom, clubPays, valeur] = c;
    if (!selection || !nom) continue;
    const slug = canonicalSlug(selection);
    if (!bySlug.has(slug)) bySlug.set(slug, []);
    bySlug.get(slug).push({
      name: nom,
      position: poste || null,
      club: clubPays || null,
      value: valeur || null,
    });
  }
  return bySlug;
}

function main() {
  const csvPath = process.argv[2];
  const outIdx = process.argv.indexOf("--out");
  const outPath = outIdx > -1 ? process.argv[outIdx + 1] : DEFAULT_OUT;

  if (!csvPath || !fs.existsSync(csvPath)) {
    console.error("✗ Usage : node scripts/wc-csv-to-json.js <csv> [--out <json>]");
    process.exit(1);
  }
  if (!fs.existsSync(outPath)) {
    console.error(`✗ Base de merge introuvable : ${outPath} (on ne régénère pas de zéro pour ne pas perdre form/calendar)`);
    process.exit(1);
  }

  const teams = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const scraped = parseCsv(csvPath);

  // ── Garde-fou global ────────────────────────────────────────────────────
  const validSlugs = [...scraped.entries()].filter(([, p]) => p.length >= MIN_PLAYERS);
  if (validSlugs.length < MIN_TEAMS) {
    console.error(
      `✗ GARDE-FOU : seulement ${validSlugs.length} sélections ≥ ${MIN_PLAYERS} joueurs ` +
        `(< ${MIN_TEAMS} requis). Scrape probablement dégradé — aucune écriture.`
    );
    process.exit(1);
  }

  // ── Merge par JOUEUR (PAS de remplacement en bloc) ────────────────────────
  //  On met à jour value/club depuis le scrape TM en PRÉSERVANT les champs
  //  API-Football de chaque joueur (api_football_id, photo, caps, age, number,
  //  position…). Remplacer players[] en entier perdrait l'effectif API-Football
  //  (photos + lien des notes de match) — bug corrigé ici.
  let updatedTeams = 0;
  let updatedPlayers = 0;
  const kept = [];
  const skipped = [];
  for (const team of teams) {
    const fresh = scraped.get(team.slug);
    if (!fresh) {
      kept.push(team.name);
      continue;
    }
    const oldCount = team.players?.length ?? 0;
    if (fresh.length < MIN_PLAYERS || (oldCount > 0 && fresh.length < oldCount * 0.5)) {
      skipped.push(`${team.name} (${fresh.length} vs ${oldCount} — gardé)`);
      continue; // scrape partiel — on ne touche pas cette équipe
    }

    // Index du scrape pour cette équipe.
    const byNorm = new Map();
    const bySurname = new Map();
    const byTokenSet = new Map();
    for (const fp of fresh) {
      const n = normName(fp.name);
      byNorm.set(n, fp);
      const sn = surnameOf(n);
      if (!bySurname.has(sn)) bySurname.set(sn, []);
      bySurname.get(sn).push({ fp, initial: initialOf(n) });
      const ts = tokenSetKey(n);
      if (!byTokenSet.has(ts)) byTokenSet.set(ts, []);
      byTokenSet.get(ts).push(fp);
    }

    const used = new Set();
    let teamTouched = false;
    for (const player of team.players || []) {
      const n = normName(player.name);
      let m = null;
      if (byNorm.has(n) && !used.has(byNorm.get(n))) {
        m = byNorm.get(n);
      } else {
        const cands = (bySurname.get(surnameOf(n)) || []).filter((c) => !used.has(c.fp));
        if (cands.length === 1) m = cands[0].fp;
        else if (cands.length > 1) {
          const byIni = cands.filter((c) => c.initial === initialOf(n));
          if (byIni.length === 1) m = byIni[0].fp;
        }
      }
      if (!m) {
        const cands = (byTokenSet.get(tokenSetKey(n)) || []).filter((fp) => !used.has(fp));
        if (cands.length === 1) m = cands[0];
      }
      if (!m) continue;
      used.add(m);

      const club = cleanClub(m.club);
      const value = cleanValue(m.value);
      if (value != null && player.value !== value) { player.value = value; teamTouched = true; updatedPlayers++; }
      if (club != null && player.club !== club) { player.club = club; teamTouched = true; }
    }
    if (teamTouched) updatedTeams++;
  }

  const updated = updatedTeams;
  if (updatedPlayers === 0) {
    console.log("• Aucune valeur/club à mettre à jour (rien à écrire).");
    process.exit(0);
  }

  const nextJson = JSON.stringify(teams, null, 2) + "\n";
  if (fs.existsSync(outPath) && fs.readFileSync(outPath, "utf8") === nextJson) {
    console.log("• Effectifs identiques — aucune écriture.");
    process.exit(0);
  }

  fs.writeFileSync(outPath, nextJson, "utf8");
  const index = teams.map((t) => ({ name: t.name, slug: t.slug }));
  fs.writeFileSync(INDEX_OUT, JSON.stringify(index, null, 2) + "\n", "utf8");

  console.log(`✓ ${updatedPlayers} joueurs (value/club) sur ${updated} sélections mis à jour → ${path.relative(ROOT, outPath)}`);
  if (skipped.length) console.log(`  ⚠ ${skipped.length} gardées (scrape partiel) : ${skipped.join(", ")}`);
  if (kept.length) console.log(`  • ${kept.length} hors CSV, inchangées : ${kept.join(", ")}`);
  process.exit(0);
}

main();
