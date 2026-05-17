// ─────────────────────────────────────────────────────────────────────────────
//  parse-wc-teams.js
//  Lit les fichiers docs/*.txt (séparateur « ; », UTF-8) et génère
//  data/wc-teams.json : 48 sélections nationales avec effectif, formes,
//  derniers scores, calendrier CDM et valeur d'effectif estimée.
//
//  Usage : node scripts/parse-wc-teams.js
//  À relancer si les .txt du dossier docs/ changent.
// ─────────────────────────────────────────────────────────────────────────────

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DOCS = path.join(ROOT, "docs");
const OUT = path.join(ROOT, "data", "wc-teams.json");

/** Slug stable et sans accents : "République Tchèque" → "republique-tcheque". */
function slugify(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function splitCsv(line) {
  return line.split(";").map((c) => c.trim());
}

function readLines(file) {
  return fs
    .readFileSync(file, "utf8")
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// ── 1. Equipes.txt : groupe / valeur effectif / forme / prochain match ──────────
// Groupe;Équipe;Valeur Effectif Global (Est.);Dynamique / Forme;Prochain Match
const teams = new Map(); // name → team object

for (const line of readLines(path.join(DOCS, "Equipes.txt")).slice(1)) {
  const [group, name, squadValue, form, nextMatch] = splitCsv(line);
  if (!name) continue;
  teams.set(name, {
    name,
    slug: slugify(name),
    group: group || null,
    squadValue: squadValue || null,
    form: form ? form.split(/,\s*/).filter(Boolean) : [],
    nextMatch: nextMatch || null,
    recentScores: [],
    calendar: [],
    players: [],
  });
}

// ── 2. Groupe * joueurs.txt : infos générales + effectif ───────────────────────
// Équipe;Catégorie;Nom;Poste;Club (Pays);Valeur Marchande
const playerFiles = fs
  .readdirSync(DOCS)
  .filter((f) => /joueurs\.txt$/i.test(f));

for (const file of playerFiles) {
  for (const line of readLines(path.join(DOCS, file)).slice(1)) {
    const [teamName, category, c2, c3, c4] = splitCsv(line);
    if (!teamName) continue;

    let team = teams.get(teamName);
    if (!team) {
      // Équipe absente d'Equipes.txt : on la crée quand même
      team = {
        name: teamName,
        slug: slugify(teamName),
        group: null,
        squadValue: null,
        form: [],
        nextMatch: null,
        recentScores: [],
        calendar: [],
        players: [],
      };
      teams.set(teamName, team);
    }

    if (/infos?\s+g[ée]n[ée]rales?/i.test(category)) {
      // c2 = "Derniers scores: a (1-0), b (2-1), …"
      // c4 = "Calendrier CDM: x | y | z"
      const scores = c2.replace(/^Derniers scores\s*:\s*/i, "").trim();
      const cal = c4.replace(/^Calendrier CDM\s*:\s*/i, "").trim();
      team.recentScores = scores ? scores.split(/,\s*/).filter(Boolean) : [];
      team.calendar = cal ? cal.split(/\s*\|\s*/).filter(Boolean) : [];
    } else if (/joueur/i.test(category)) {
      team.players.push({
        name: c2,
        position: c3 || null,
        club: c4 || null,
        value: splitCsv(line)[5] || null,
      });
    }
  }
}

// ── 3. Dédoublonnage ───────────────────────────────────────────────────────────
// Certaines sélections figurent dans deux poules du docs (ex. Ouzbékistan en
// C et H) : on garde la première occurrence de chaque joueur.
for (const team of teams.values()) {
  const seen = new Set();
  team.players = team.players.filter((p) => {
    if (seen.has(p.name)) return false;
    seen.add(p.name);
    return true;
  });
}

// ── 4. Sortie ──────────────────────────────────────────────────────────────────
const data = [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(data, null, 2) + "\n", "utf8");

// Index léger { name, slug } — importé côté client (liens cliquables) sans
// embarquer tous les effectifs dans le bundle.
const INDEX = path.join(ROOT, "data", "wc-teams-index.json");
const index = data.map((t) => ({ name: t.name, slug: t.slug }));
fs.writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n", "utf8");

const withPlayers = data.filter((t) => t.players.length > 0).length;
console.log(
  `✓ ${data.length} équipes écrites dans data/wc-teams.json ` +
    `(${withPlayers} avec effectif détaillé)`
);
