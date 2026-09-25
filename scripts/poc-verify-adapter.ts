// Vérification ponctuelle : le FootballDataOrgProvider (lib/providers/football-data-org.ts)
// produit-il des DTOs cohérents à partir des payloads RÉELS de l'API ?
// Lecture seule. Fait partie du POC, pas un test permanent (pas de
// skip-gate car appelé une seule fois manuellement, pas via `npm test`).

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

const { footballDataOrg } = await import("../lib/providers/football-data-org.ts");

const competitions = await footballDataOrg.getCompetitions();
console.log("getCompetitions():", JSON.stringify(competitions, null, 2));

const competitionExternalId = competitions[0]?.external_id;
const seasons = await footballDataOrg.getSeasons(competitionExternalId);
console.log(`\ngetSeasons(${competitionExternalId}):`, JSON.stringify(seasons, null, 2));

const seasonExternalId = seasons[seasons.length - 1]?.external_id;
const participants = await footballDataOrg.getParticipants(seasonExternalId);
console.log(`\ngetParticipants(): ${participants.length} participants. Exemple:`, JSON.stringify(participants[0], null, 2));

const events = await footballDataOrg.getEvents(seasonExternalId);
console.log(`\ngetEvents(): ${events.length} events.`);
const finishedEvent = events.find((e) => e.status === "finished");
console.log("Exemple event FINISHED:", JSON.stringify(finishedEvent, null, 2));
const scheduledEvent = events.find((e) => e.status === "scheduled");
console.log("Exemple event SCHEDULED:", JSON.stringify(scheduledEvent, null, 2));

const participantIds = new Set(participants.map((p) => p.external_id));
const orphanRefs = events
  .flatMap((e) => e.participants.map((p) => p.participant_external_id))
  .filter((id) => !participantIds.has(id));
console.log(`\nCohérence participant_external_id: ${orphanRefs.length} référence(s) d'event pointant vers un participant absent de getParticipants().`);
if (orphanRefs.length > 0) console.log("Exemples orphelins:", [...new Set(orphanRefs)].slice(0, 5));

const standings = await footballDataOrg.getStandings(seasonExternalId);
console.log(`\ngetStandings(): ${standings.length} groupe(s). Exemple ligne:`, JSON.stringify(standings[0]?.rows?.[0], null, 2));

const standingsRefs = standings.flatMap((s) => s.rows.map((r) => r.participant_external_id));
const orphanStandingsRefs = standingsRefs.filter((id) => !participantIds.has(id));
console.log(`Cohérence standings -> participants: ${orphanStandingsRefs.length} référence(s) orpheline(s).`);

const matchdays = [...new Set(events.map((e) => e.matchday).filter((m) => m != null))].sort((a, b) => a! - b!);
console.log(`\nMatchdays observés: ${matchdays.join(", ")}`);
console.log(`Stages observés: ${[...new Set(events.map((e) => e.stage))].join(", ")}`);
