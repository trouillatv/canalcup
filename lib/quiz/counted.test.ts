// Garde-fou du plafond de scoring quiz. Exécuter : `npm test`
// (runner natif Node, sans dépendance — strip des types TypeScript par Node 22).
//
// Régression couverte : le plafond de 60 était appliqué comme un budget GLOBAL
// partagé entre toutes les sessions. Quiz #1 (60 questions) le consommait
// entièrement → Quiz #2 comptait 0. Ces tests figent la règle « 60 PAR quiz ».

import { test } from "node:test";
import assert from "node:assert/strict";
import { countedQuestionIdsFromSessions, QUIZ_COUNTED_QUESTION_LIMIT } from "./counted.ts";

const ids = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}-${i}`);

test("deux quiz de 60 : la session 1 n'épuise jamais le quota de la session 2", () => {
  const q1 = ids("q1", 60);
  const q2 = ids("q2", 60);
  const counted = countedQuestionIdsFromSessions([
    { created_at: "2026-07-03", question_ids: q1 },
    { created_at: "2026-07-15", question_ids: q2 },
  ]);
  // Les 60 du Quiz #1 ET les 60 du Quiz #2 comptent → 120 distinctes.
  assert.equal(counted.size, 120);
  for (const id of q1) assert.ok(counted.has(id), `Quiz#1 ${id} doit compter`);
  for (const id of q2) assert.ok(counted.has(id), `Quiz#2 ${id} doit compter`);
});

test("cas 60 + 25 : chaque quiz compte l'intégralité de ses questions (≤ 60)", () => {
  const q1 = ids("q1", 60);
  const q2 = ids("q2", 25);
  const counted = countedQuestionIdsFromSessions([
    { created_at: "2026-07-03", question_ids: q1 },
    { created_at: "2026-07-15", question_ids: q2 },
  ]);
  assert.equal(counted.size, 85);
  for (const id of q2) assert.ok(counted.has(id), `Quiz#2 ${id} doit compter`);
});

test("une session > 60 est plafonnée à ses 60 premières questions", () => {
  const q = ids("q", 65);
  const counted = countedQuestionIdsFromSessions([{ created_at: "2026-07-03", question_ids: q }]);
  assert.equal(counted.size, QUIZ_COUNTED_QUESTION_LIMIT);
  assert.ok(counted.has("q-59"));
  assert.ok(!counted.has("q-60"), "la 61e question ne doit pas compter");
});

test("comptage sur questions DISTINCTES : un doublon ne consomme pas de créneau supplémentaire", () => {
  // 60 questions distinctes + le 1er id répété : la 60e distincte (« q-59 »)
  // doit rester comptée (le doublon ne doit pas la faire tomber au-delà de 60).
  const q = [...ids("q", 60), "q-0"];
  const counted = countedQuestionIdsFromSessions([{ created_at: "2026-07-03", question_ids: q }]);
  assert.equal(counted.size, 60);
  assert.ok(counted.has("q-59"), "la 60e question distincte doit compter malgré le doublon");
});

test("l'ordre des sessions n'influence pas l'ensemble compté", () => {
  const q1 = ids("q1", 60);
  const q2 = ids("q2", 40);
  const a = countedQuestionIdsFromSessions([
    { created_at: "2026-07-03", question_ids: q1 },
    { created_at: "2026-07-15", question_ids: q2 },
  ]);
  const b = countedQuestionIdsFromSessions([
    { created_at: "2026-07-15", question_ids: q2 },
    { created_at: "2026-07-03", question_ids: q1 },
  ]);
  assert.deepEqual([...a].sort(), [...b].sort());
});

test("régression : l'ancien budget global aurait compté 0 question du Quiz #2 — plus le cas", () => {
  const q1 = ids("q1", 60);
  const q2 = ids("q2", 40);
  const counted = countedQuestionIdsFromSessions([
    { created_at: "2026-07-03", question_ids: q1 },
    { created_at: "2026-07-15", question_ids: q2 },
  ]);
  const q2Counted = q2.filter((id) => counted.has(id)).length;
  assert.equal(q2Counted, 40, "toutes les questions du Quiz #2 doivent désormais compter");
});
