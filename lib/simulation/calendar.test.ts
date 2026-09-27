// Tests unitaires — intégrité du calendrier réel Champions League (Lot 3C).

import { test } from "node:test";
import assert from "node:assert/strict";
import { CALENDAR, ALL_TEAMS } from "./calendar.ts";

test("144 rencontres au total (8 journées x 18 matchs)", () => {
  assert.equal(CALENDAR.length, 144);
});

test("8 journées, 18 matchs chacune", () => {
  const counts = new Map<number, number>();
  for (const f of CALENDAR) counts.set(f.matchday, (counts.get(f.matchday) ?? 0) + 1);
  assert.deepEqual([...counts.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const count of counts.values()) assert.equal(count, 18);
});

test("journée 1 : 18/18 résultats réels renseignés", () => {
  const md1 = CALENDAR.filter((f) => f.matchday === 1);
  assert.equal(md1.length, 18);
  assert.ok(md1.every((f) => f.realResult !== null));
});

test("journées 2 à 8 : aucun résultat réel (matchs non joués)", () => {
  const rest = CALENDAR.filter((f) => f.matchday > 1);
  assert.equal(rest.length, 126);
  assert.ok(rest.every((f) => f.realResult === null));
});

test("identifiants de rencontre tous uniques", () => {
  const ids = new Set(CALENDAR.map((f) => f.id));
  assert.equal(ids.size, CALENDAR.length);
});

test("aucune équipe ne joue contre elle-même", () => {
  assert.ok(CALENDAR.every((f) => f.home !== f.away));
});

test("36 équipes distinctes, cohérent avec le format ligue à 36", () => {
  assert.equal(ALL_TEAMS.length, 36);
});

test("chaque résultat réel a des scores entiers non négatifs", () => {
  for (const f of CALENDAR) {
    if (!f.realResult) continue;
    assert.ok(Number.isInteger(f.realResult.home_score) && f.realResult.home_score >= 0);
    assert.ok(Number.isInteger(f.realResult.away_score) && f.realResult.away_score >= 0);
  }
});
