// Garde-fou : reproduit les deux trous de calendrier réellement vécus.
//   npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarHealth } from "./calendar-health.ts";

const NOW = new Date("2026-07-17T12:00:00Z");
const done = (phase: string, day: string) => ({ phase, status: "finished", starts_at: `2026-07-${day}T19:00:00Z` });
const soon = (phase: string, day: string) => ({ phase, status: "upcoming", starts_at: `2026-07-${day}T19:00:00Z` });

test("cas vécu : la finale manque en base → alerte", () => {
  const h = calendarHealth([
    done("Quarts", "09"), done("Quarts", "10"),
    done("Demis", "14"), done("Demis", "15"),
    soon("3ème place", "18"),
  ], NOW);
  assert.equal(h.state, "warn");
  assert.deepEqual(h.missing, ["Finale"]);
});

test("cas vécu : un quart jamais inséré alors que les huitièmes sont joués", () => {
  const h = calendarHealth([done("Huitièmes", "05"), done("Huitièmes", "06")], NOW);
  assert.equal(h.state, "warn");
  assert.ok(h.missing.includes("Quarts"));
});

test("calendrier complet → aucune alerte", () => {
  const h = calendarHealth([
    done("Demis", "14"), done("Demis", "15"),
    soon("3ème place", "18"), soon("Finale", "19"),
  ], NOW);
  assert.equal(h.state, "ok");
  assert.equal(h.upcoming, 2);
});

test("phase en cours (pas encore finie) → on ne conclut rien", () => {
  const h = calendarHealth([done("Quarts", "09"), soon("Quarts", "20")], NOW);
  assert.equal(h.state, "ok");
});

test("un match 'à venir' déjà passé ne compte pas comme à venir → alerte", () => {
  // Symptôme d'une synchro morte : la ligne reste 'upcoming' des jours après.
  const h = calendarHealth([done("Quarts", "09"), soon("Quarts", "12")], NOW);
  assert.equal(h.state, "warn");
  assert.equal(h.upcoming, 0);
});

test("tournoi terminé (finale jouée) → aucune alerte malgré 0 match à venir", () => {
  const h = calendarHealth([
    done("Demis", "14"), done("3ème place", "18"), done("Finale", "19"),
  ], NOW);
  assert.equal(h.state, "ok");
  assert.equal(h.upcoming, 0);
});
