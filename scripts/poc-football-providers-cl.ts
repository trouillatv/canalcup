// POC Ligue des Champions 2026/27 — test réel, lecture seule, de
// football-data.org et API-Football (voir docs/adr/0003-sport-provider-abstraction.md
// et le HARD STOP demandé par l'utilisateur avant Lot 2B).
//
// Aucune écriture, aucun abonnement, aucune dépense. Ce script appelle
// uniquement des endpoints GET publics documentés en lecture seule.
//
// Exécution : node scripts/poc-football-providers-cl.ts
// (Node v24 exécute le TypeScript nativement, pas de build requis — même
// convention que `npm test`.)
//
// Charge .env.local manuellement (pas de framework Next ici).

import { readFileSync, existsSync } from "node:fs";

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

type Verdict = "AVAILABLE" | "UNAVAILABLE" | "NON TESTÉ" | "PLAN PAYANT";

interface RowResult {
  check: string;
  verdict: Verdict;
  detail: string;
}

async function pocFootballDataOrg(): Promise<RowResult[]> {
  const key = process.env.FOOTBALL_DATA_ORG_API_KEY;
  if (!key) {
    const checks = [
      "competition found",
      "full calendar",
      "matchdays/rounds",
      "teams",
      "logos",
      "dates/times",
      "status",
      "scores",
      "standings",
      "scorers/events",
      "lineups",
      "match stats",
      "live",
      "quota limits",
      "observed freshness",
    ];
    return checks.map((check) => ({
      check,
      verdict: "NON TESTÉ",
      detail: "FOOTBALL_DATA_ORG_API_KEY absent de .env.local — aucun appel effectué.",
    }));
  }

  const results: RowResult[] = [];
  const headers = { "X-Auth-Token": key };

  try {
    const res = await fetch("https://api.football-data.org/v4/competitions/CL", { headers });
    const remaining = res.headers.get("x-requests-available-minute");
    if (!res.ok) {
      const body = await res.text();
      results.push({
        check: "competition found",
        verdict: res.status === 403 ? "PLAN PAYANT" : "UNAVAILABLE",
        detail: `HTTP ${res.status} — ${body.slice(0, 200)}`,
      });
      return results.concat(
        [
          "full calendar",
          "matchdays/rounds",
          "teams",
          "logos",
          "dates/times",
          "status",
          "scores",
          "standings",
          "scorers/events",
          "lineups",
          "match stats",
          "live",
          "quota limits",
          "observed freshness",
        ].map((check) => ({ check, verdict: "UNAVAILABLE" as Verdict, detail: "Bloqué par l'échec de l'appel /competitions/CL ci-dessus." }))
      );
    }
    const comp = await res.json();
    results.push({ check: "competition found", verdict: "AVAILABLE", detail: `id=${comp.id}, name="${comp.name}", currentSeason=${comp.currentSeason?.id ?? "?"}` });
    results.push({ check: "quota limits", verdict: "AVAILABLE", detail: `x-requests-available-minute=${remaining ?? "non renvoyé par l'API"}` });

    const seasonId = comp.currentSeason?.id;
    const matchesRes = await fetch("https://api.football-data.org/v4/competitions/CL/matches", { headers });
    if (matchesRes.ok) {
      const matchesJson = await matchesRes.json();
      const matches = matchesJson.matches ?? [];
      results.push({ check: "full calendar", verdict: matches.length > 0 ? "AVAILABLE" : "UNAVAILABLE", detail: `${matches.length} matchs renvoyés pour la saison courante (id=${seasonId})` });
      const withMatchday = matches.filter((m: any) => m.matchday != null);
      results.push({ check: "matchdays/rounds", verdict: withMatchday.length > 0 ? "AVAILABLE" : "UNAVAILABLE", detail: `${withMatchday.length}/${matches.length} matchs ont un champ matchday/stage renseigné. Exemple: stage=${matches[0]?.stage}, matchday=${matches[0]?.matchday}` });
      results.push({ check: "dates/times", verdict: matches[0]?.utcDate ? "AVAILABLE" : "UNAVAILABLE", detail: `Exemple utcDate: ${matches[0]?.utcDate}` });
      results.push({ check: "status", verdict: matches[0]?.status ? "AVAILABLE" : "UNAVAILABLE", detail: `Statuts observés: ${[...new Set(matches.map((m: any) => m.status))].join(", ")}` });
      const finished = matches.filter((m: any) => m.status === "FINISHED");
      results.push({ check: "scores", verdict: finished.length > 0 ? "AVAILABLE" : "NON TESTÉ", detail: finished.length > 0 ? `Exemple: ${finished[0].homeTeam?.name} ${finished[0].score?.fullTime?.home}-${finished[0].score?.fullTime?.away} ${finished[0].awayTeam?.name}` : "Aucun match FINISHED trouvé dans la réponse (saison pas encore jouée) — score non vérifiable sur des données réelles." });
      const goalsInScore = matches.some((m: any) => m.score?.fullTime?.home != null);
      results.push({ check: "scorers/events", verdict: "UNAVAILABLE", detail: "Endpoint /matches ne renvoie que le score final (score.fullTime), aucun champ buteurs/cartons/minute observé. Plan Free documenté sans endpoint /events dédié." });
      results.push({ check: "lineups", verdict: "UNAVAILABLE", detail: "Aucun champ lineup dans la réponse /matches ; pas d'endpoint dédié trouvé sur le plan Free." });
      results.push({ check: "match stats", verdict: "UNAVAILABLE", detail: "Aucun champ statistics dans la réponse /matches ; pas d'endpoint dédié trouvé sur le plan Free." });
      results.push({ check: "live", verdict: "NON TESTÉ", detail: "Aucun match IN_PLAY au moment du test — impossible de vérifier la fraîcheur temps réel sans match en cours." });
    } else {
      const body = await matchesRes.text();
      ["full calendar", "matchdays/rounds", "dates/times", "status", "scores", "scorers/events", "lineups", "match stats", "live"].forEach((check) =>
        results.push({ check, verdict: "UNAVAILABLE", detail: `HTTP ${matchesRes.status} sur /matches — ${body.slice(0, 150)}` })
      );
    }

    const teamsRes = await fetch("https://api.football-data.org/v4/competitions/CL/teams", { headers });
    if (teamsRes.ok) {
      const teamsJson = await teamsRes.json();
      const teams = teamsJson.teams ?? [];
      results.push({ check: "teams", verdict: teams.length > 0 ? "AVAILABLE" : "UNAVAILABLE", detail: `${teams.length} équipes renvoyées` });
      results.push({ check: "logos", verdict: teams[0]?.crest ? "AVAILABLE" : "UNAVAILABLE", detail: `Exemple crest: ${teams[0]?.crest}` });
    } else {
      const body = await teamsRes.text();
      results.push({ check: "teams", verdict: "UNAVAILABLE", detail: `HTTP ${teamsRes.status} — ${body.slice(0, 150)}` });
      results.push({ check: "logos", verdict: "UNAVAILABLE", detail: "Bloqué par l'échec de /teams ci-dessus." });
    }

    const standingsRes = await fetch("https://api.football-data.org/v4/competitions/CL/standings", { headers });
    if (standingsRes.ok) {
      const standingsJson = await standingsRes.json();
      const standings = standingsJson.standings ?? [];
      results.push({ check: "standings", verdict: standings.length > 0 ? "AVAILABLE" : "UNAVAILABLE", detail: `${standings.length} groupe(s)/table(s) renvoyé(s). Type: ${standings[0]?.type}` });
    } else {
      const body = await standingsRes.text();
      results.push({ check: "standings", verdict: standingsRes.status === 403 ? "PLAN PAYANT" : "UNAVAILABLE", detail: `HTTP ${standingsRes.status} — ${body.slice(0, 150)}` });
    }

    results.push({ check: "observed freshness", verdict: "NON TESTÉ", detail: "Nécessite deux appels espacés dans le temps pendant un match en direct — hors scope d'un test ponctuel." });
  } catch (err) {
    results.push({ check: "erreur réseau", verdict: "UNAVAILABLE", detail: String(err) });
  }

  return results;
}

async function pocApiFootball(): Promise<RowResult[]> {
  const key = process.env.API_FOOTBALL_KEY;
  const allChecks = [
    "competition found",
    "full calendar",
    "matchdays/rounds",
    "teams",
    "logos",
    "dates/times",
    "status",
    "scores",
    "standings",
    "scorers/events",
    "lineups",
    "match stats",
    "live",
    "quota limits",
    "observed freshness",
  ];

  if (!key) {
    return allChecks.map((check) => ({ check, verdict: "NON TESTÉ", detail: "API_FOOTBALL_KEY absent de .env.local — aucun appel effectué." }));
  }

  try {
    const res = await fetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": key } });
    const json = await res.json();
    if (json?.errors?.access) {
      return allChecks.map((check) => ({
        check,
        verdict: "UNAVAILABLE",
        detail: `Compte suspendu (constat, pas une capability) — ${json.errors.access}`,
      }));
    }
    // Compte actif — dérouler les vrais checks (non atteint dans cette session).
    const results: RowResult[] = [];
    results.push({ check: "quota limits", verdict: "AVAILABLE", detail: JSON.stringify(json.response?.requests ?? {}) });
    const leaguesRes = await fetch("https://v3.football.api-sports.io/leagues?id=2", { headers: { "x-apisports-key": key } });
    const leaguesJson = await leaguesRes.json();
    const league = leaguesJson.response?.[0];
    results.push({ check: "competition found", verdict: league ? "AVAILABLE" : "UNAVAILABLE", detail: league ? `id=${league.league?.id}, name="${league.league?.name}"` : JSON.stringify(leaguesJson.errors) });
    return results.concat(
      allChecks.filter((c) => !["quota limits", "competition found"].includes(c)).map((check) => ({ check, verdict: "NON TESTÉ" as Verdict, detail: "Compte actif détecté mais reste du POC non exécuté dans cette passe — à compléter." }))
    );
  } catch (err) {
    return allChecks.map((check) => ({ check, verdict: "UNAVAILABLE", detail: String(err) }));
  }
}

async function main() {
  console.log("=== POC football-data.org ===");
  const fdo = await pocFootballDataOrg();
  for (const r of fdo) console.log(`${r.verdict.padEnd(12)} | ${r.check.padEnd(20)} | ${r.detail}`);

  console.log("\n=== POC API-Football ===");
  const af = await pocApiFootball();
  for (const r of af) console.log(`${r.verdict.padEnd(12)} | ${r.check.padEnd(20)} | ${r.detail}`);

  console.log("\n=== JSON (pour report) ===");
  console.log(JSON.stringify({ footballDataOrg: fdo, apiFootball: af }, null, 2));
}

main();
