// Garde-fou : reproduit les faux comptages réellement constatés en base.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasShootout, isCountedGoal, isOwnGoal } from "./goals.ts";

const goal = (detail: string | null, minute: number) => ({ type: "goal", detail, minute });

// --- 1. penalty marqué en cours de match → compté
test("penalty marqué à la 22e → compté", () => {
  // cas réel : Oyarzabal 22' (pen.) en demi-finale France-Espagne
  assert.equal(isCountedGoal(goal("Penalty", 22), false), true);
  // même dans un match qui ira aux tirs au but
  assert.equal(isCountedGoal(goal("Penalty", 22), true), true);
});

// --- 2. penalty manqué → jamais compté
test("penalty manqué à la 22e → non compté", () => {
  assert.equal(isCountedGoal(goal("Missed Penalty", 22), false), false);
  assert.equal(isCountedGoal(goal("Missed Penalty", 22), true), false);
});

// --- 3 & 4. tirs au but : dans la timeline, hors classement des buteurs
test("tir de séance marqué → non compté", () => {
  // cas réel Suisse 0-0 Colombie : minute=120 + extra_minute
  assert.equal(isCountedGoal(goal("Penalty", 120), true), false);
  // cas réel Allemagne 1-1 Paraguay : minutes absolues 122..132
  assert.equal(isCountedGoal(goal("Penalty", 125), true), false);
});

test("tir de séance manqué → non compté", () => {
  assert.equal(isCountedGoal(goal("Missed Penalty", 120), true), false);
  assert.equal(isCountedGoal(goal("Missed Penalty", 128), true), false);
});

test("l'événement reste exploitable pour la timeline (on ne le supprime pas)", () => {
  // isCountedGoal ne filtre QUE l'agrégation : le type reste 'goal', la
  // timeline continue d'afficher la séance.
  const e = goal("Penalty", 120);
  assert.equal(e.type, "goal");
});

// --- 5. match sans séance → aucun filtrage indu
test("match sans séance → un but tardif reste compté", () => {
  // un but à la 120e+ en prolongation est légitime s'il n'y a pas eu de séance
  assert.equal(isCountedGoal(goal("Normal Goal", 120), false), true);
  assert.equal(isCountedGoal(goal("Normal Goal", 121), false), true);
});

test("match sans séance → buts normaux comptés", () => {
  assert.equal(isCountedGoal(goal("Normal Goal", 1), false), true);
  assert.equal(isCountedGoal(goal("Normal Goal", 90), false), true);
  assert.equal(isCountedGoal(goal("Own Goal", 55), false), true);
});

// --- prolongation SANS séance : le but doit compter
test("cas réel finale : but à la 106e en prolongation → compté", () => {
  // Espagne 1-0 Argentine a.p., Ferran Torres 106'. Pas de tirs au but,
  // donc aucune exclusion ne doit s'appliquer.
  assert.equal(isCountedGoal(goal("Normal Goal", 106), false), true);
  // et même si la minute est tardive, tant qu'il n'y a pas eu de séance
  assert.equal(isCountedGoal(goal("Normal Goal", 118), false), true);
});

test("prolongation avec séance : un but AVANT la 120e reste compté", () => {
  // garde-fou : la règle ne doit pas exclure toute la prolongation
  assert.equal(isCountedGoal(goal("Normal Goal", 105), true), true);
  assert.equal(isCountedGoal(goal("Penalty", 119), true), true);
});

// --- non-buts
test("les événements non-'goal' ne sont jamais des buts", () => {
  for (const type of ["yellow_card", "red_card", "substitution", "var", "penalty_missed"]) {
    assert.equal(isCountedGoal({ type, detail: null, minute: 30 }, false), false);
  }
});

// --- détection de séance
test("hasShootout : détecte pen_a/pen_b, y compris un 0", () => {
  assert.equal(hasShootout({ pen_a: 4, pen_b: 3 }), true);
  assert.equal(hasShootout({ pen_a: 0, pen_b: 3 }), true); // 0 ≠ absence
  assert.equal(hasShootout({ pen_a: null, pen_b: null }), false);
  assert.equal(hasShootout({}), false);
});

test("isOwnGoal : csc identifié", () => {
  assert.equal(isOwnGoal(goal("Own Goal", 55)), true);
  assert.equal(isOwnGoal(goal("Normal Goal", 55)), false);
});

// --- régression : les deux matchs qui cassaient le classement
test("régression Suisse 0-0 Colombie : 10 'goal' en base → 0 but compté", () => {
  // séance 4-3, stockée en minute=120 (+extra_minute 1..5)
  const seance = [
    goal("Penalty", 120), goal("Penalty", 120), goal("Missed Penalty", 120),
    goal("Penalty", 120), goal("Penalty", 120), goal("Penalty", 120),
    goal("Missed Penalty", 120), goal("Penalty", 120), goal("Missed Penalty", 120),
    goal("Penalty", 120),
  ];
  const comptes = seance.filter((e) => isCountedGoal(e, true)).length;
  assert.equal(comptes, 0);
});

test("régression Allemagne 1-1 Paraguay : 14 'goal' en base → 2 buts comptés", () => {
  const events = [
    goal("Normal Goal", 42), // Enciso
    goal("Normal Goal", 54), // Havertz
    // séance en minutes absolues
    goal("Missed Penalty", 122), goal("Penalty", 124), goal("Penalty", 125),
    goal("Penalty", 125), goal("Penalty", 126), goal("Penalty", 127),
    goal("Missed Penalty", 128), goal("Missed Penalty", 129), goal("Penalty", 130),
    goal("Missed Penalty", 131), goal("Missed Penalty", 132), goal("Penalty", 132),
  ];
  const comptes = events.filter((e) => isCountedGoal(e, true)).length;
  assert.equal(comptes, 2);
});
