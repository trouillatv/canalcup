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

  // ── Merge prudent par équipe ────────────────────────────────────────────
  let updated = 0;
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
      continue; // ne JAMAIS régresser
    }
    team.players = fresh;
    updated++;
  }

  if (updated === 0) {
    console.log("• Aucune équipe mise à jour (rien à écrire).");
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

  console.log(`✓ ${updated} sélections mises à jour → ${path.relative(ROOT, outPath)}`);
  if (skipped.length) console.log(`  ⚠ ${skipped.length} gardées (scrape partiel) : ${skipped.join(", ")}`);
  if (kept.length) console.log(`  • ${kept.length} hors CSV, inchangées : ${kept.join(", ")}`);
  process.exit(0);
}

main();
