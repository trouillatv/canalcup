// Tests unitaires — abstraction SportProvider/FootballProvider (Lot 2A,
// voir docs/adr/0003-sport-provider-abstraction.md).
//
// Deux catégories :
// - Structurels (pas de réseau) : toujours exécutés par `npm test`.
// - Réseau réel, lecture seule : auto-skip si la clé correspondante est
//   absente/placeholder, pour ne jamais faire échouer `npm test` faute de
//   secret local. Ils vérifient une FORME de réponse (tableau), pas un
//   contenu précis — la vérification factuelle des capabilities est le
//   rôle du rapport POC (docs/poc-football-providers-cl-2026-27.md), pas
//   de ce fichier.

import { test } from "node:test";
import assert from "node:assert/strict";
import { hasCapability } from "./sport-provider.ts";
import { footballDataOrg } from "./football-data-org.ts";
import { apiFootball } from "./api-football.ts";
import { getActiveFootballProvider } from "./registry.ts";

test("hasCapability() ne renvoie true que pour une capability déclarée", () => {
  assert.equal(hasCapability(footballDataOrg, "fixtures"), true);
  assert.equal(hasCapability(footballDataOrg, "lineups"), false);
});

test("getActiveFootballProvider() renvoie football-data.org par défaut (Décision A)", () => {
  const original = process.env.FOOTBALL_PROVIDER;
  delete process.env.FOOTBALL_PROVIDER;
  try {
    assert.equal(getActiveFootballProvider().id, "football-data.org");
  } finally {
    if (original !== undefined) process.env.FOOTBALL_PROVIDER = original;
  }
});

test("getActiveFootballProvider() bascule sur api-football via FOOTBALL_PROVIDER", () => {
  const original = process.env.FOOTBALL_PROVIDER;
  process.env.FOOTBALL_PROVIDER = "api-football";
  try {
    assert.equal(getActiveFootballProvider().id, "api-football");
  } finally {
    if (original !== undefined) process.env.FOOTBALL_PROVIDER = original;
    else delete process.env.FOOTBALL_PROVIDER;
  }
});

test("getActiveFootballProvider() rejette une valeur FOOTBALL_PROVIDER inconnue", () => {
  const original = process.env.FOOTBALL_PROVIDER;
  process.env.FOOTBALL_PROVIDER = "sportmonks";
  try {
    assert.throws(() => getActiveFootballProvider());
  } finally {
    if (original !== undefined) process.env.FOOTBALL_PROVIDER = original;
    else delete process.env.FOOTBALL_PROVIDER;
  }
});

test("football-data.org: getCompetitions() rejette explicitement sans clé", async () => {
  const original = process.env.FOOTBALL_DATA_ORG_API_KEY;
  delete process.env.FOOTBALL_DATA_ORG_API_KEY;
  try {
    await assert.rejects(() => footballDataOrg.getCompetitions());
  } finally {
    if (original !== undefined) process.env.FOOTBALL_DATA_ORG_API_KEY = original;
  }
});

test("api-football: getCompetitions() rejette explicitement sans clé", async () => {
  const original = process.env.API_FOOTBALL_KEY;
  delete process.env.API_FOOTBALL_KEY;
  try {
    await assert.rejects(() => apiFootball.getCompetitions());
  } finally {
    if (original !== undefined) process.env.API_FOOTBALL_KEY = original;
  }
});

const fdoKeyConfigured = !!process.env.FOOTBALL_DATA_ORG_API_KEY;
const afKeyConfigured = !!process.env.API_FOOTBALL_KEY;

test(
  "football-data.org: getCompetitions() renvoie un tableau (clé réelle, lecture seule)",
  { skip: !fdoKeyConfigured && "FOOTBALL_DATA_ORG_API_KEY non configuree (.env.local)" },
  async () => {
    const competitions = await footballDataOrg.getCompetitions();
    assert.ok(Array.isArray(competitions));
  }
);

test(
  "api-football: getCompetitions() renvoie un tableau (clé réelle, lecture seule)",
  { skip: !afKeyConfigured && "API_FOOTBALL_KEY non configuree (.env.local)" },
  async () => {
    const competitions = await apiFootball.getCompetitions();
    assert.ok(Array.isArray(competitions));
  }
);
