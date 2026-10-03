import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  normalizeMatchCenter,
  recentFormFor,
  type RawMatchCenterEvent,
  type RawPrediction,
  type RawRecentEvent,
  type RawSquadMembership,
  type RawStandingSnapshot,
} from "./match-center.ts";

function rawEvent(overrides: Partial<RawMatchCenterEvent> = {}): RawMatchCenterEvent {
  return {
    id: "event-target-1",
    season_id: "season-1",
    starts_at: "2026-10-14T19:00:00Z",
    venue: null,
    status: "scheduled",
    stage: "LEAGUE_STAGE",
    matchday: 2,
    leg: null,
    result: {},
    metadata: {},
    seasons: { label: "2026-2027", competitions: { name: "UEFA Champions League", slug: "uefa-champions-league" } },
    event_participants: [
      {
        role: "home",
        participants: {
          id: "home-target",
          name: "Paris Saint-Germain FC",
          short_name: "PSG",
          country: "France",
          metadata: { logo_url: "https://crests.example/psg.png" },
        },
      },
      {
        role: "away",
        participants: {
          id: "away-target",
          name: "Arsenal FC",
          short_name: "Arsenal",
          country: "England",
          metadata: { logo_url: "https://crests.example/arsenal.png" },
        },
      },
    ],
    ...overrides,
  };
}

function squad(participantId: string, count: number): RawSquadMembership[] {
  return Array.from({ length: count }, (_, index) => ({
    participant_id: participantId,
    players: {
      id: `${participantId}-player-${index}`,
      name: `Player ${index}`,
      position: index === 0 ? "Goalkeeper" : "Midfield",
      nationality: "France",
      date_of_birth: null,
    },
  }));
}

const standings: RawStandingSnapshot[] = [
  {
    participant_id: "home-target",
    group_label: "League phase",
    matchday: 2,
    position: 5,
    played: 1,
    won: 1,
    drawn: 0,
    lost: 0,
    points: 3,
    goal_difference: 2,
    synced_at: "2026-09-27T00:00:00Z",
  },
  {
    participant_id: "away-target",
    group_label: "League phase",
    matchday: 2,
    position: 12,
    played: 1,
    won: 0,
    drawn: 1,
    lost: 0,
    points: 1,
    goal_difference: 0,
    synced_at: "2026-09-27T00:00:00Z",
  },
];

function recentEvent(
  id: string,
  startsAt: string,
  homeId: string,
  awayId: string,
  homeScore: number,
  awayScore: number,
  status = "finished"
): RawRecentEvent {
  return {
    id,
    starts_at: startsAt,
    status,
    result: { home_score: homeScore, away_score: awayScore },
    event_participants: [
      { role: "home", participants: { id: homeId } },
      { role: "away", participants: { id: awayId } },
    ],
  };
}

test("match center: event TARGET existant normalise home/away et logos", () => {
  const match = normalizeMatchCenter(rawEvent());

  assert.equal(match.eventId, "event-target-1");
  assert.equal(match.home.id, "home-target");
  assert.equal(match.away.id, "away-target");
  assert.equal(match.home.logoUrl, "https://crests.example/psg.png");
  assert.equal(match.competitionSlug, "uefa-champions-league");
});

test("match center: scheduled sans score et CTA pronostic possible", () => {
  const match = normalizeMatchCenter(rawEvent({ starts_at: "2099-10-14T19:00:00Z", status: "scheduled", result: {} }));

  assert.equal(match.score, null);
  assert.equal(match.statusLabel, "À venir");
  assert.equal(match.canPredict, true);
});

test("match center: finished expose le score depuis events.result", () => {
  const match = normalizeMatchCenter(
    rawEvent({ status: "finished", result: { home_score: 2, away_score: 1 } })
  );

  assert.deepEqual(match.score, { home: 2, away: 1 });
  assert.equal(match.canPredict, false);
});

test("match center: effectif disponible et effectif vide toleres proprement", () => {
  const match = normalizeMatchCenter(rawEvent(), { squads: squad("home-target", 20) });

  assert.equal(match.home.squadStatus, "available");
  assert.equal(match.home.squad.length, 20);
  assert.equal(match.away.squadStatus, "empty");
  assert.equal(match.hasSquads, true);
});

test("match center: effectif partiel n'est pas presente comme lineup", () => {
  const match = normalizeMatchCenter(rawEvent(), { squads: squad("away-target", 6) });

  assert.equal(match.away.squadStatus, "partial");
  assert.equal(match.missingData.includes("effectifs complets"), true);
});

test("match center: standings latest par participant", () => {
  const match = normalizeMatchCenter(rawEvent(), {
    standings: [
      ...standings,
      { ...standings[0], matchday: 1, position: 30, points: 0, synced_at: "2026-09-01T00:00:00Z" },
    ],
  });

  assert.equal(match.hasStandings, true);
  assert.equal(match.home.standing?.position, 5);
  assert.equal(match.away.standing?.points, 1);
});

test("match center: forme recente V/N/D correcte home et away, du plus recent au plus ancien", () => {
  const recentEvents = [
    recentEvent("old-win", "2026-09-01T19:00:00Z", "home-target", "club-a", 2, 0),
    recentEvent("draw-away", "2026-09-12T19:00:00Z", "club-b", "home-target", 1, 1),
    recentEvent("loss-home", "2026-09-20T19:00:00Z", "home-target", "club-c", 0, 1),
    recentEvent("away-win", "2026-09-22T19:00:00Z", "club-d", "away-target", 0, 3),
    recentEvent("away-loss", "2026-09-23T19:00:00Z", "away-target", "club-e", 1, 2),
  ];

  const match = normalizeMatchCenter(rawEvent(), { recentEvents });

  assert.deepEqual(match.home.recentForm.map((entry) => entry.result), ["D", "N", "V"]);
  assert.deepEqual(match.away.recentForm.map((entry) => entry.result), ["D", "V"]);
  assert.deepEqual(match.away.recentForm.map((entry) => `${entry.goalsFor}-${entry.goalsAgainst}`), ["1-2", "3-0"]);
});

test("match center: forme recente ignore futurs, non-finished, scores incomplets et limite a 5", () => {
  const recentEvents = [
    recentEvent("latest", "2026-10-10T19:00:00Z", "home-target", "club-a", 1, 0),
    recentEvent("scheduled", "2026-10-09T19:00:00Z", "home-target", "club-b", 3, 0, "scheduled"),
    recentEvent("future", "2026-10-15T19:00:00Z", "home-target", "club-c", 3, 0),
    { ...recentEvent("bad-score", "2026-10-08T19:00:00Z", "home-target", "club-d", 0, 0), result: {} },
    recentEvent("r2", "2026-10-07T19:00:00Z", "home-target", "club-e", 1, 1),
    recentEvent("r3", "2026-10-06T19:00:00Z", "home-target", "club-f", 0, 2),
    recentEvent("r4", "2026-10-05T19:00:00Z", "home-target", "club-g", 4, 2),
    recentEvent("r5", "2026-10-04T19:00:00Z", "home-target", "club-h", 2, 2),
    recentEvent("r6", "2026-10-03T19:00:00Z", "home-target", "club-i", 5, 0),
  ];

  const form = recentFormFor("home-target", recentEvents, "2026-10-14T19:00:00Z");

  assert.deepEqual(form.map((entry) => entry.eventId), ["latest", "r2", "r3", "r4", "r5"]);
  assert.deepEqual(form.map((entry) => entry.result), ["V", "N", "D", "V", "N"]);
});

test("match center: forme recente vide si aucun historique fiable", () => {
  const match = normalizeMatchCenter(rawEvent(), {
    recentEvents: [recentEvent("other", "2026-09-01T19:00:00Z", "club-a", "club-b", 1, 0)],
  });

  assert.deepEqual(match.home.recentForm, []);
  assert.deepEqual(match.away.recentForm, []);
});

test("match center: prediction isolee par user par appelant, pas de melange cross-user", () => {
  const userPrediction: RawPrediction = {
    id: "prediction-user-a",
    payload: { home: 2, away: 0 },
    status: "pending",
    points_awarded: null,
    submitted_at: "2026-10-01T00:00:00Z",
    market_types: { code: "exact_score" },
  };
  const match = normalizeMatchCenter(rawEvent(), { prediction: userPrediction });
  const anonymous = normalizeMatchCenter(rawEvent(), { prediction: null });

  assert.equal(match.prediction?.id, "prediction-user-a");
  assert.deepEqual(match.prediction?.payload, { home: 2, away: 0 });
  assert.equal(anonymous.prediction, null);
});

test("match center: 404 propre represente par absence d'event dans la couche serveur", () => {
  const page = readFileSync("app/cs/match/[eventId]/page.tsx", "utf8");

  assert.equal(page.includes("notFound()"), true);
});

test("match center page: TARGET only, aucune SOURCE, aucune mutation, pas de SOURCE.matches", () => {
  const page = readFileSync("app/cs/match/[eventId]/page.tsx", "utf8");
  const model = readFileSync("lib/canal-sports/match-center.ts", "utf8");
  const combined = `${page}\n${model}`;

  assert.equal(combined.includes("@/lib/legacy"), false);
  assert.equal(combined.includes("createLegacy"), false);
  assert.equal(combined.includes("SOURCE"), false);
  assert.equal(combined.includes('.from("matches")'), false);
  assert.equal(/\.(insert|update|upsert|delete|rpc)\(/.test(combined), false);
  assert.equal(combined.includes('.from("events")'), true);
  assert.equal(combined.includes("event_participants"), true);
  assert.equal(combined.includes("squad_memberships"), true);
  assert.equal(combined.includes("standings_snapshots"), true);
  assert.equal(combined.includes('.eq("status", "finished")'), true);
  assert.equal(combined.includes('.lt("starts_at", rawEvent.starts_at)'), true);
  assert.equal(combined.includes("scorers"), true);
  assert.equal(combined.includes("predictions"), true);
});

test("match center page: UX sans titre redondant, dette technique masquee, effectifs replies", () => {
  const page = readFileSync("app/cs/match/[eventId]/page.tsx", "utf8");

  assert.equal(page.includes("<h1"), false);
  assert.equal(page.includes("Non affiche"), false);
  assert.equal(page.includes("missingData.join"), false);
  assert.equal(page.includes("Phase de ligue"), true);
  assert.equal(page.includes("Contexte du match"), true);
  assert.equal(page.includes("Forme récente"), true);
  assert.equal(page.includes("function positionLabel"), true);
  assert.equal(page.includes("{player.position}</span>"), false);
  assert.equal(page.includes("slice(0, 6)"), true);
  assert.equal(page.includes("lg:hidden"), true);
  assert.equal(page.includes("lg:block"), true);
  assert.equal(page.includes("<details"), true);
  assert.equal(page.includes("Effectif de saison / pas la composition du match."), true);
});
