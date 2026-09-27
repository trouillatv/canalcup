// Tests unitaires — génération de saison simulée (Lot 3C).

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, deriveSeed } from "./rng.ts";
import { CALENDAR, ALL_TEAMS } from "./calendar.ts";
import { buildTeamStrengths } from "./team-strength.ts";
import { generateSeason } from "./season-generator.ts";

const strengths = buildTeamStrengths(ALL_TEAMS, 42);

test("journée 1 : résultat toujours identique au résultat réel, jamais marqué simulé", () => {
  const rng = createRng(deriveSeed(42, "season-test", 1));
  const season = generateSeason(CALENDAR, strengths, rng);
  const md1 = season.filter((f) => f.matchday === 1);
  assert.equal(md1.length, 18);
  for (const f of md1) {
    assert.equal(f.wasSimulated, false);
    assert.deepEqual(f.result, f.realResult);
  }
});

test("journées 2 à 8 : toujours marquées simulées, avec un score généré", () => {
  const rng = createRng(deriveSeed(42, "season-test", 2));
  const season = generateSeason(CALENDAR, strengths, rng);
  const rest = season.filter((f) => f.matchday > 1);
  assert.equal(rest.length, 126);
  for (const f of rest) {
    assert.equal(f.wasSimulated, true);
    assert.ok(Number.isInteger(f.result.home_score) && f.result.home_score >= 0);
    assert.ok(Number.isInteger(f.result.away_score) && f.result.away_score >= 0);
  }
});

test("même rng (même état initial) => même saison générée", () => {
  const rngA = createRng(deriveSeed(42, "season-test", "determinism"));
  const rngB = createRng(deriveSeed(42, "season-test", "determinism"));
  const seasonA = generateSeason(CALENDAR, strengths, rngA);
  const seasonB = generateSeason(CALENDAR, strengths, rngB);
  assert.deepEqual(seasonA, seasonB);
});

test("rng différent => journée 1 identique (réel, fixe) mais journées 2-8 différentes", () => {
  const rngA = createRng(deriveSeed(42, "season-test", "a"));
  const rngB = createRng(deriveSeed(42, "season-test", "b"));
  const seasonA = generateSeason(CALENDAR, strengths, rngA);
  const seasonB = generateSeason(CALENDAR, strengths, rngB);

  const md1A = seasonA.filter((f) => f.matchday === 1).map((f) => f.result);
  const md1B = seasonB.filter((f) => f.matchday === 1).map((f) => f.result);
  assert.deepEqual(md1A, md1B);

  const restA = seasonA.filter((f) => f.matchday > 1).map((f) => f.result);
  const restB = seasonB.filter((f) => f.matchday > 1).map((f) => f.result);
  assert.notDeepEqual(restA, restB);
});

test("144 rencontres générées, ordre du calendrier préservé", () => {
  const rng = createRng(deriveSeed(42, "season-test", 3));
  const season = generateSeason(CALENDAR, strengths, rng);
  assert.equal(season.length, 144);
  for (let i = 0; i < CALENDAR.length; i++) {
    assert.equal(season[i].id, CALENDAR[i].id);
  }
});
