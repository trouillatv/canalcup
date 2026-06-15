// backfill-tm-values.js
//
// Le sync API-Football (sync-apif-worldcup-squads.js) a réécrit les effectifs
// avec des noms abrégés ("M. Maignan") ; le merge par nom exact n'a pas retrouvé
// les données Transfermarkt indexées sous le nom complet ("Mike Maignan"), donc
// value / caps / selection_goals sont tombés à null.
//
// Ce script RÉCUPÈRE ces données depuis le dernier enrichi TM (offline, instantané)
// pour les joueurs ACTUELLEMENT en sélection (effectif API-Football). Il n'écrase
// JAMAIS les champs venant de l'API (name, photo, api_football_id, age, number,
// position). Les notes restent captées par la clé API (hors de ce fichier).
//
// Appariement : par équipe, nom de famille + initiale du prénom (robuste à
// "M. Maignan" ↔ "Mike Maignan"). Ambiguïtés et non-appariés sont signalés
// (joueurs nouvellement convoqués → à ré-enrichir via le script Python TM).
//
// Dry-run par défaut :
//   node scripts/backfill-tm-values.js
// Applique data/wc-teams.json :
//   node scripts/backfill-tm-values.js --apply
//   node scripts/backfill-tm-values.js --apply --backup <chemin enrichi>

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const TEAMS_PATH = path.join(ROOT, "data", "wc-teams.json");
const OUT_DIR = path.join(ROOT, "docs", "script", "output");
const PROPOSED_PATH = path.join(OUT_DIR, "wc-teams-tm-backfill.proposed.json");
const REPORT_PATH = path.join(OUT_DIR, "tm-backfill-report.json");

const APPLY = process.argv.includes("--apply");
const backupArgIdx = process.argv.indexOf("--backup");
const DEFAULT_BACKUP = path.join(OUT_DIR, "wc-teams-enriched.backup-20260519-164130.json");
const BACKUP_PATH = backupArgIdx !== -1 ? process.argv[backupArgIdx + 1] : DEFAULT_BACKUP;

// Champs venant de Transfermarkt qu'on veut restaurer (jamais ceux de l'API).
const TM_FIELDS = [
  "value",
  "caps",
  "selection_goals",
  "selection_yellow_cards",
  "selection_red_cards",
  "club",
  "birth_date",
];

const COMBINING_MARKS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

// Particules de nom de famille à recoller au dernier token (De Bruyne, Van Dijk…).
const PARTICLES = new Set([
  "de", "del", "della", "di", "da", "dos", "van", "von", "der", "den",
  "la", "le", "el", "al", "bin", "ben", "mc", "mac", "san", "st",
]);

function surnameOf(norm) {
  const toks = norm.split(" ").filter(Boolean);
  if (toks.length <= 1) return norm;
  let i = toks.length - 1;
  // recolle une particule précédente : "van dijk", "de bruyne"
  while (i - 1 >= 1 && PARTICLES.has(toks[i - 1])) i--;
  return toks.slice(i).join(" ");
}

function initialOf(norm) {
  const first = norm.split(" ").filter(Boolean)[0] || "";
  return first.charAt(0);
}

// Clé d'ensemble de tokens (ordre-insensible) : "son heung min" → "heung min son".
// Permet d'apparier les noms à l'ordre inversé (sélections asiatiques :
// "Son Heung-Min" côté effectif ↔ "Heung-min Son" côté Transfermarkt).
function tokenSetKey(norm) {
  return norm.split(" ").filter(Boolean).sort().join(" ");
}

function hasTm(player) {
  return TM_FIELDS.some((f) => player[f] != null);
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function main() {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.error(`Backup enrichi introuvable : ${BACKUP_PATH}`);
    process.exit(1);
  }
  const teams = loadJson(TEAMS_PATH);
  const backup = loadJson(BACKUP_PATH);

  const backupByTeam = new Map(backup.map((t) => [normalizeName(t.name), t.players || []]));

  const report = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    backup_file: path.relative(ROOT, BACKUP_PATH),
    teams: teams.length,
    players_total: 0,
    players_already_had_tm: 0,
    players_recovered: 0,
    players_unmatched: 0,
    players_ambiguous: 0,
    teams_no_backup: [],
    unmatched: [],
    ambiguous: [],
  };

  const updated = teams.map((team) => {
    const bplayers = backupByTeam.get(normalizeName(team.name));
    const players = (team.players || []).map((p) => ({ ...p }));

    if (!bplayers) {
      if (players.length) report.teams_no_backup.push(team.name);
      report.players_total += players.length;
      return { ...team, players };
    }

    // Index backup : surname -> [{ player, initial, norm }]
    const bySurname = new Map();
    const byNorm = new Map();
    const byTokenSet = new Map();
    for (const bp of bplayers) {
      const n = normalizeName(bp.name);
      byNorm.set(n, bp);
      const sn = surnameOf(n);
      if (!bySurname.has(sn)) bySurname.set(sn, []);
      bySurname.get(sn).push({ player: bp, initial: initialOf(n), norm: n });
      const ts = tokenSetKey(n);
      if (!byTokenSet.has(ts)) byTokenSet.set(ts, []);
      byTokenSet.get(ts).push(bp);
    }
    const usedBackup = new Set();

    for (const player of players) {
      report.players_total++;
      if (hasTm(player)) {
        report.players_already_had_tm++;
        continue;
      }
      const n = normalizeName(player.name);
      let match = null;

      // 1) nom complet normalisé exact
      if (byNorm.has(n) && !usedBackup.has(byNorm.get(n))) {
        match = byNorm.get(n);
      } else {
        // 2) nom de famille (+ initiale si plusieurs candidats)
        const cands = (bySurname.get(surnameOf(n)) || []).filter(
          (c) => !usedBackup.has(c.player)
        );
        if (cands.length === 1) {
          match = cands[0].player;
        } else if (cands.length > 1) {
          const ini = initialOf(n);
          const byIni = cands.filter((c) => c.initial === ini);
          if (byIni.length === 1) {
            match = byIni[0].player;
          } else {
            report.players_ambiguous++;
            report.ambiguous.push({
              team: team.name,
              player: player.name,
              candidates: cands.map((c) => c.player.name),
            });
            continue;
          }
        }
      }

      // 3) même ensemble de tokens, ordre inversé (noms asiatiques/arabes).
      //    Égalité exacte d'ensemble → haute précision (pas pour noms abrégés).
      if (!match) {
        const cands3 = (byTokenSet.get(tokenSetKey(n)) || []).filter(
          (bp) => !usedBackup.has(bp)
        );
        if (cands3.length === 1) match = cands3[0];
      }

      if (!match) {
        report.players_unmatched++;
        report.unmatched.push({ team: team.name, player: player.name });
        continue;
      }

      usedBackup.add(match);
      let recoveredAny = false;
      for (const f of TM_FIELDS) {
        if (player[f] == null && match[f] != null) {
          player[f] = match[f];
          recoveredAny = true;
        }
      }
      if (recoveredAny) {
        // provenance des stats sélection = Transfermarkt (les notes restent API)
        if (match.stats_source) player.stats_source = match.stats_source;
        if (match.stats_source_url) player.stats_source_url = match.stats_source_url;
        if (match.stats_updated_at) player.stats_updated_at = match.stats_updated_at;
        report.players_recovered++;
      }
    }

    return { ...team, players };
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(PROPOSED_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  if (APPLY) {
    fs.writeFileSync(TEAMS_PATH, `${JSON.stringify(updated, null, 2)}\n`, "utf8");
  }

  console.log(`Backup utilisé      : ${report.backup_file}`);
  console.log(`Joueurs (effectif)  : ${report.players_total}`);
  console.log(`Déjà enrichis TM    : ${report.players_already_had_tm}`);
  console.log(`Récupérés           : ${report.players_recovered}`);
  console.log(`Ambigus (à vérifier): ${report.players_ambiguous}`);
  console.log(`Non appariés        : ${report.players_unmatched}`);
  if (report.teams_no_backup.length) {
    console.log(`Équipes sans backup : ${report.teams_no_backup.join(", ")}`);
  }
  console.log(`\nProposé : ${path.relative(ROOT, PROPOSED_PATH)}`);
  console.log(`Rapport : ${path.relative(ROOT, REPORT_PATH)}`);
  if (!APPLY) {
    console.log("\n— DRY-RUN — relance avec --apply pour écrire data/wc-teams.json.");
  } else {
    console.log("\n✅ data/wc-teams.json mis à jour.");
  }
}

main();
