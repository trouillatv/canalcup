// sync-apif-worldcup-squads.js
//
// Builds the Canal Cup -> API-Football team_id mapping from World Cup fixtures,
// then fetches each national-team squad through /players/squads.
//
// Dry-run by default:
//   node scripts/sync-apif-worldcup-squads.js
//
// Apply data/wc-teams.json updates:
//   node scripts/sync-apif-worldcup-squads.js --apply

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env.local");
const TEAMS_PATH = path.join(ROOT, "data", "wc-teams.json");
const OUT_DIR = path.join(ROOT, "docs", "script", "output");
const MAPPING_PATH = path.join(OUT_DIR, "api-football-wc2026-team-mapping.json");
const REPORT_PATH = path.join(OUT_DIR, "api-football-wc2026-squads-report.json");

const API_BASE = "https://v3.football.api-sports.io";
const WC_LEAGUE = process.env.APIF_WC_LEAGUE || "1";
const WC_SEASON = process.env.APIF_WC_SEASON || "2026";
const APPLY = process.argv.includes("--apply");

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const idx = trimmed.indexOf("=");
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

const API_TO_CANAL = {
  "south africa": "Afrique du Sud",
  "algeria": "Algérie",
  "germany": "Allemagne",
  "england": "Angleterre",
  "saudi arabia": "Arabie Saoudite",
  "argentina": "Argentine",
  "australia": "Australie",
  "austria": "Autriche",
  "belgium": "Belgique",
  "bosnia and herzegovina": "Bosnie-Herzégovine",
  "bosnia herzegovina": "Bosnie-Herzégovine",
  "brazil": "Brésil",
  "canada": "Canada",
  "cape verde islands": "Cap-Vert",
  "cape verde": "Cap-Vert",
  "colombia": "Colombie",
  "south korea": "Corée du Sud",
  "korea republic": "Corée du Sud",
  "ivory coast": "Côte d'Ivoire",
  "cote d ivoire": "Côte d'Ivoire",
  "croatia": "Croatie",
  "curacao": "Curaçao",
  "scotland": "Écosse",
  "egypt": "Égypte",
  "ecuador": "Équateur",
  "spain": "Espagne",
  "usa": "États-Unis",
  "united states": "États-Unis",
  "france": "France",
  "ghana": "Ghana",
  "haiti": "Haïti",
  "iraq": "Irak",
  "iran": "Iran",
  "japan": "Japon",
  "jordan": "Jordanie",
  "morocco": "Maroc",
  "mexico": "Mexique",
  "norway": "Norvège",
  "new zealand": "Nouvelle-Zélande",
  "uzbekistan": "Ouzbékistan",
  "panama": "Panama",
  "paraguay": "Paraguay",
  "netherlands": "Pays-Bas",
  "portugal": "Portugal",
  "qatar": "Qatar",
  "congo dr": "RD Congo",
  "dr congo": "RD Congo",
  "czech republic": "Tchéquie",
  "czechia": "Tchéquie",
  "senegal": "Sénégal",
  "sweden": "Suède",
  "switzerland": "Suisse",
  "tunisia": "Tunisie",
  "turkiye": "Turquie",
  "turkey": "Turquie",
  "uruguay": "Uruguay",
};

function canalNameForApi(apiName) {
  return API_TO_CANAL[normalizeName(apiName)] || null;
}

function normalizePosition(position) {
  const value = String(position || "").toLowerCase();
  if (value.includes("goal")) return "Gardien";
  if (value.includes("def")) return "Défenseur";
  if (value.includes("mid")) return "Milieu";
  if (value.includes("att") || value.includes("forw")) return "Attaquant";
  return position || null;
}

async function apiGet(pathname) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${pathname}: ${JSON.stringify(json).slice(0, 300)}`);
  }
  if (json.errors && Object.keys(json.errors).length) {
    throw new Error(`API errors on ${pathname}: ${JSON.stringify(json.errors)}`);
  }
  return json;
}

function mergeApiPlayers(existingPlayers, apiPlayers, retrievedAt) {
  const existingByName = new Map(
    (existingPlayers || []).map((player) => [normalizeName(player.name), player])
  );

  return apiPlayers.map((player) => {
    const previous = existingByName.get(normalizeName(player.name)) || {};
    return {
      ...previous,
      name: player.name,
      position: normalizePosition(player.position) || previous.position || null,
      club: previous.club || null,
      value: previous.value || null,
      caps: previous.caps ?? null,
      selection_goals: previous.selection_goals ?? previous.goals ?? null,
      selection_yellow_cards: previous.selection_yellow_cards ?? null,
      selection_red_cards: previous.selection_red_cards ?? null,
      age: player.age ?? previous.age ?? null,
      api_football_id: player.id ?? previous.api_football_id ?? null,
      number: player.number ?? previous.number ?? null,
      photo: player.photo ?? previous.photo ?? null,
      stats_source: previous.stats_source || "API-Football",
      stats_source_url: previous.stats_source_url || null,
      stats_updated_at: retrievedAt,
    };
  });
}

async function main() {
  loadEnv();
  if (!process.env.API_FOOTBALL_KEY) {
    throw new Error("API_FOOTBALL_KEY missing in .env.local or environment");
  }

  const teams = JSON.parse(fs.readFileSync(TEAMS_PATH, "utf8"));
  const mapping = new Map();
  const unknownApiTeams = [];

  const fixturesJson = await apiGet(`/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}`);
  const fixtures = fixturesJson.response || [];
  for (const fixture of fixtures) {
    for (const side of ["home", "away"]) {
      const apiTeam = fixture.teams?.[side];
      if (!apiTeam?.id || !apiTeam?.name) continue;
      const canalName = canalNameForApi(apiTeam.name);
      if (!canalName) {
        unknownApiTeams.push({ api_name: apiTeam.name, api_team_id: apiTeam.id });
        continue;
      }
      if (!mapping.has(canalName)) {
        mapping.set(canalName, {
          canal_name: canalName,
          api_football_team_id: apiTeam.id,
          api_football_name: apiTeam.name,
          logo: apiTeam.logo || null,
        });
      }
    }
  }

  const expected = new Set([...mapping.keys()]);
  const sourceTeamNames = new Set(teams.map((team) => team.name));
  const missingInSource = [...expected].filter((name) => !sourceTeamNames.has(name));
  const skippedNonFixtureTeams = teams
    .map((team) => team.name)
    .filter((name) => !expected.has(name));
  const retrievedAt = new Date().toISOString();
  const squadResults = [];
  const updatedTeams = teams.map((team) => ({ ...team }));

  for (const team of updatedTeams) {
    const mapped = mapping.get(team.name);
    if (!mapped) {
      squadResults.push({ canal_name: team.name, ok: false, reason: "not_in_worldcup_fixtures", players: 0 });
      continue;
    }

    const squadJson = await apiGet(`/players/squads?team=${mapped.api_football_team_id}`);
    const squads = squadJson.response || [];
    const apiPlayers = squads.flatMap((squad) => squad.players || []);
    if (!apiPlayers.length) {
      squadResults.push({
        canal_name: team.name,
        api_football_team_id: mapped.api_football_team_id,
        ok: false,
        reason: "empty_squad",
        players: 0,
      });
      continue;
    }

    team.api_football_team_id = mapped.api_football_team_id;
    team.api_football_name = mapped.api_football_name;
    team.api_football_logo = mapped.logo;
    team.api_football_synced_at = retrievedAt;
    team.players = mergeApiPlayers(team.players || [], apiPlayers, retrievedAt);

    squadResults.push({
      canal_name: team.name,
      api_football_team_id: mapped.api_football_team_id,
      ok: true,
      players: apiPlayers.length,
    });
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mappingPayload = {
    generated_at: retrievedAt,
    league: Number(WC_LEAGUE),
    season: Number(WC_SEASON),
    fixture_count: fixtures.length,
    mapped_count: mapping.size,
    missing_in_source: missingInSource,
    skipped_non_fixture_teams: skippedNonFixtureTeams,
    unknown_api_teams: unknownApiTeams,
    teams: [...mapping.values()].sort((a, b) => a.canal_name.localeCompare(b.canal_name, "fr")),
  };
  fs.writeFileSync(MAPPING_PATH, `${JSON.stringify(mappingPayload, null, 2)}\n`, "utf8");

  const reportPayload = {
    generated_at: retrievedAt,
    apply: APPLY,
    selection_count: mapping.size,
    source_team_count: updatedTeams.length,
    skipped_non_fixture_count: skippedNonFixtureTeams.length,
    skipped_non_fixture_teams: skippedNonFixtureTeams,
    synced_count: squadResults.filter((r) => r.ok).length,
    failed_count: squadResults.filter((r) => !r.ok && r.reason !== "not_in_worldcup_fixtures").length,
    total_players: squadResults.reduce((sum, r) => sum + r.players, 0),
    results: squadResults,
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(reportPayload, null, 2)}\n`, "utf8");

  if (APPLY) {
    fs.writeFileSync(TEAMS_PATH, `${JSON.stringify(updatedTeams, null, 2)}\n`, "utf8");
  }

  console.log(`Fixtures API-Football: ${fixtures.length}`);
  console.log(`Mapping: ${mapping.size}/${expected.size}`);
  console.log(`Squads synced: ${reportPayload.synced_count}/${mapping.size}`);
  console.log(`Players fetched: ${reportPayload.total_players}`);
  if (missingInSource.length) console.log(`Missing in data/wc-teams.json: ${missingInSource.join(", ")}`);
  if (skippedNonFixtureTeams.length) console.log(`Skipped non-WC fixture teams: ${skippedNonFixtureTeams.join(", ")}`);
  if (unknownApiTeams.length) {
    console.log(`Unknown API teams: ${[...new Set(unknownApiTeams.map((t) => t.api_name))].join(", ")}`);
  }
  console.log(`Wrote ${path.relative(ROOT, MAPPING_PATH)}`);
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
  if (!APPLY) console.log("Dry-run only. Re-run with --apply to update data/wc-teams.json.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
