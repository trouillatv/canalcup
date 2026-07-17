// Garde-fou : le planificateur ne doit JAMAIS placer un match d'élimination
// avant les matchs qui lui envoient ses participants.
//
// Cas vécu (17/07/2026) : les 2 demies ET la finale se sont retrouvées sur le
// créneau de 11h00, et la petite finale à 11h30 — donc la finale programmée
// AVANT les demies censées la remplir. Cause : à la génération, la finale n'a
// aucune équipe (ses slots attendent les vainqueurs), donc ni la règle « pas 2
// matchs pour la même équipe dans un créneau » ni les disponibilités ne la
// repoussaient. Seule la capacité du créneau la limitait.
//
//   npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKnockout } from "./generate.ts";
import { schedule, type SchedulerSlot } from "./scheduler.ts";

const SLOTS: SchedulerSlot[] = [
  { key: "fri_1100", day: "fri", start: "11:00", label: "Ven 11h00" },
  { key: "fri_1130", day: "fri", start: "11:30", label: "Ven 11h30" },
  { key: "fri_1200", day: "fri", start: "12:00", label: "Ven 12h00" },
  { key: "fri_1230", day: "fri", start: "12:30", label: "Ven 12h30" },
];

const run = (seeds: string[]) => {
  const gen = generateKnockout(seeds, { koTarget: 7, finalTarget: 10, startOrder: 1000 });
  const res = schedule(gen, {
    slots: SLOTS, matchesPerSlot: 3, slotStartISO: () => null, forceDay: "fri",
  });
  const ordinal = (localId: string) => res.assignments.find((a) => a.localId === localId)!.rotation;
  return { gen, res, ordinal };
};

test("la finale est planifiée APRÈS les deux demies", () => {
  const { gen, ordinal } = run(["s1", "s2", "s3", "s4"]);
  const semis = gen.filter((g) => g.phase === "semi");
  const final = gen.find((g) => g.phase === "final")!;
  assert.equal(semis.length, 2);
  for (const s of semis) {
    assert.ok(
      ordinal(final.localId)! > ordinal(s.localId)!,
      `finale (créneau ${ordinal(final.localId)}) doit être après la demie (créneau ${ordinal(s.localId)})`
    );
  }
});

test("la petite finale est planifiée APRÈS les deux demies", () => {
  const { gen, ordinal } = run(["s1", "s2", "s3", "s4"]);
  const third = gen.find((g) => g.phase === "third")!;
  for (const s of gen.filter((g) => g.phase === "semi")) {
    assert.ok(ordinal(third.localId)! > ordinal(s.localId)!);
  }
});

test("tout match chaîné passe après son match nourricier", () => {
  const { gen, ordinal } = run(["s1", "s2", "s3", "s4", "s5", "s6"]); // avec barrages
  for (const g of gen) {
    for (const nextId of [g.next_local_id, g.loser_next_local_id]) {
      if (!nextId) continue;
      const from = ordinal(g.localId), to = ordinal(nextId);
      if (from == null || to == null) continue; // non plaçable → signalé en conflit
      assert.ok(to > from, `${g.round} (créneau ${from}) doit précéder son match suivant (créneau ${to})`);
    }
  }
});

test("les demies restent groupées sur le premier créneau disponible", () => {
  const { gen, ordinal } = run(["s1", "s2", "s3", "s4"]);
  const semis = gen.filter((g) => g.phase === "semi").map((g) => ordinal(g.localId));
  assert.deepEqual(semis, [1, 1], "les 2 demies s'enchaînent sur la même table, même créneau");
});
