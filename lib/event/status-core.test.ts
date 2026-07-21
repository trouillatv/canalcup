// Garde-fou du drapeau de clôture. Exécuter : `npm test`
//
// Deux risques à figer :
//  1. Fermer la compétition PAR ACCIDENT (valeur inconnue interprétée comme
//     « closed ») → tout le site en lecture seule sans que personne l'ait demandé.
//  2. Le cache qui masque une bascule ou qui gèle le site si Supabase tousse.

import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEventStatus, createEventStatusCache } from "./status-core.ts";

test("clé absente / valeur vide → la compétition reste OUVERTE", () => {
  assert.equal(parseEventStatus(undefined), "open");
  assert.equal(parseEventStatus(null), "open");
  assert.equal(parseEventStatus(""), "open");
  assert.equal(parseEventStatus({}), "open");
});

test("on ne ferme que sur un signal explicite", () => {
  assert.equal(parseEventStatus("closed"), "closed");
  assert.equal(parseEventStatus('"closed"'), "closed"); // jsonb rendu brut
  assert.equal(parseEventStatus("  CLOSED  "), "closed");
  assert.equal(parseEventStatus(true), "closed");
  assert.equal(parseEventStatus({ status: "closed" }), "closed");
  assert.equal(parseEventStatus({ closed: true }), "closed");
});

test("toute valeur inconnue laisse la compétition ouverte (pas de fermeture accidentelle)", () => {
  assert.equal(parseEventStatus("open"), "open");
  assert.equal(parseEventStatus("terminé"), "open");
  assert.equal(parseEventStatus("finished"), "open");
  assert.equal(parseEventStatus(42), "open");
  assert.equal(parseEventStatus({ status: "banana" }), "open");
  assert.equal(parseEventStatus(false), "open");
  assert.equal(parseEventStatus({ closed: false }), "open");
});

test("le cache évite une requête par écriture, puis expire", async () => {
  let calls = 0;
  let clock = 0;
  const cache = createEventStatusCache(
    async () => {
      calls += 1;
      return "open";
    },
    30_000,
    () => clock
  );

  assert.equal(await cache.get(), "open");
  assert.equal(await cache.get(), "open");
  assert.equal(calls, 1, "2e lecture servie par le cache");

  clock = 29_999;
  await cache.get();
  assert.equal(calls, 1, "toujours dans la fenêtre");

  clock = 30_001;
  await cache.get();
  assert.equal(calls, 2, "cache expiré → relecture");
});

test("invalidate() rend la bascule admin immédiate", async () => {
  let value: "open" | "closed" = "open";
  const cache = createEventStatusCache(async () => value, 30_000, () => 0);

  assert.equal(await cache.get(), "open");
  value = "closed";
  assert.equal(await cache.get(), "open", "sans invalidation, le cache tient");

  cache.invalidate();
  assert.equal(await cache.get(), "closed", "après bascule admin, effet immédiat");
});

test("lectures concurrentes → une seule requête (pas de stampede)", async () => {
  let calls = 0;
  const cache = createEventStatusCache(async () => {
    calls += 1;
    await new Promise((r) => setTimeout(r, 5));
    return "closed";
  }, 30_000, () => 0);

  const all = await Promise.all([cache.get(), cache.get(), cache.get(), cache.get()]);
  assert.deepEqual(all, ["closed", "closed", "closed", "closed"]);
  assert.equal(calls, 1);
});

test("panne de lecture : on ne gèle pas le site (fail open) et on garde la dernière valeur connue", async () => {
  let mode: "ok" | "boom" = "boom";
  let clock = 0;
  const cache = createEventStatusCache(
    async () => {
      if (mode === "boom") throw new Error("supabase down");
      return "closed";
    },
    30_000,
    () => clock
  );

  // Aucune valeur connue + panne → ouvert (les joueurs continuent de jouer).
  assert.equal(await cache.get(), "open");

  // On apprend que c'est fermé…
  mode = "ok";
  clock = 60_000;
  assert.equal(await cache.get(), "closed");

  // …puis la base retombe : on ne doit PAS ré-ouvrir la compétition.
  mode = "boom";
  clock = 120_000;
  assert.equal(await cache.get(), "closed", "valeur connue conservée malgré la panne");
});
