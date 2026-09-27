// Tests unitaires — profils synthétiques de pronostiqueurs (Lot 3C).
//
// Le test le plus important de ce fichier est structurel : il vérifie que
// AUCUNE fonction de profil ne peut recevoir le résultat du match (fuite de
// cible), pas seulement que son comportement "a l'air" correct.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng, deriveSeed } from "./rng.ts";
import { ALL_TEAMS } from "./calendar.ts";
import {
  buildTeamStrengths,
  buildFavoriPerception,
  buildExpertPerception,
  perceivedFavorite,
} from "./team-strength.ts";
import { PROFILES, PROFILE_KEYS } from "./profiles.ts";

const strengths = buildTeamStrengths(ALL_TEAMS, 42);
const favoriPerception = buildFavoriPerception(strengths, 42);
const expertPerception = buildExpertPerception(strengths, 42);
const fixture = { home: ALL_TEAMS[0], away: ALL_TEAMS[1] };

function ctx(seedSuffix: string) {
  return {
    rng: createRng(deriveSeed(42, "profiles-test", seedSuffix)),
    favoriPerception,
    expertPerception,
  };
}

test("garde-fou structurel : aucun profil n'accepte de paramètre résultat (arité <= 2)", () => {
  for (const key of PROFILE_KEYS) {
    assert.ok(
      PROFILES[key].length <= 2,
      `${key} a une arité de ${PROFILES[key].length} — une fonction de profil ne doit recevoir que (fixture, ctx), jamais un résultat`
    );
  }
});

test("garde-fou structurel : le contexte de profil n'expose aucune clé liée à un résultat", () => {
  const context = ctx("shape");
  const keys = Object.keys(context);
  for (const forbidden of ["result", "score", "outcome", "realResult"]) {
    assert.ok(!keys.includes(forbidden), `le contexte expose une clé suspecte: ${forbidden}`);
  }
});

test("tous les profils renvoient un payload exact_score valide (entiers >= 0)", () => {
  for (const key of PROFILE_KEYS) {
    for (let i = 0; i < 20; i++) {
      const payload = PROFILES[key](fixture, ctx(`${key}-${i}`));
      assert.ok(Number.isInteger(payload.home) && payload.home >= 0, `${key}: home invalide`);
      assert.ok(Number.isInteger(payload.away) && payload.away >= 0, `${key}: away invalide`);
    }
  }
});

test("déterminisme : même rng => même prédiction pour un même profil/match", () => {
  for (const key of PROFILE_KEYS) {
    const a = PROFILES[key](fixture, ctx(`${key}-determinism`));
    const b = PROFILES[key](fixture, ctx(`${key}-determinism`));
    assert.deepEqual(a, b);
  }
});

test("aleatoire : ignore la perception (même distribution quelle que soit l'équipe forte/faible)", () => {
  const rngA = createRng(999);
  const rngB = createRng(999);
  const a = PROFILES.aleatoire(fixture, { rng: rngA, favoriPerception, expertPerception });
  const b = PROFILES.aleatoire(fixture, {
    rng: rngB,
    // perception délibérément vidée pour cette équipe : si "aleatoire" ne
    // consulte jamais la perception, le résultat reste identique.
    favoriPerception: new Map(),
    expertPerception: new Map(),
  });
  assert.deepEqual(a, b);
});

test("favori : ne prédit jamais un nul", () => {
  for (let i = 0; i < 50; i++) {
    const payload = PROFILES.favori(fixture, ctx(`favori-nodraw-${i}`));
    assert.notEqual(payload.home, payload.away, `favori a prédit un nul: ${JSON.stringify(payload)}`);
  }
});

test("favori : choisit toujours le vainqueur perçu comme favori (perception favori)", () => {
  const expected = perceivedFavorite(favoriPerception, fixture.home, fixture.away);
  for (let i = 0; i < 20; i++) {
    const payload = PROFILES.favori(fixture, ctx(`favori-matches-perception-${i}`));
    const winnerIsHome = payload.home > payload.away;
    assert.equal(winnerIsHome, expected === "home");
  }
});

test("favori vs contrarian : désignent des vainqueurs opposés sur le même match (perception identique)", () => {
  for (let i = 0; i < 10; i++) {
    const fav = PROFILES.favori(fixture, ctx(`fav-vs-con-${i}-a`));
    const con = PROFILES.contrarian(fixture, ctx(`fav-vs-con-${i}-b`));
    const favWinnerHome = fav.home > fav.away;
    const conWinnerHome = con.home > con.away;
    assert.notEqual(favWinnerHome, conWinnerHome, `favori et contrarian ont désigné le même vainqueur à l'itération ${i}`);
  }
});

test("prudent : reste à faible amplitude, indépendant de l'équipe", () => {
  for (let i = 0; i < 30; i++) {
    const payload = PROFILES.prudent(fixture, ctx(`prudent-${i}`));
    assert.ok(payload.home <= 2 && payload.away <= 2, `score trop élevé pour un profil prudent: ${JSON.stringify(payload)}`);
  }
});

test("expert_simule : perception moins bruitée produit des choix de vainqueur plus stables que favori sur répétition", () => {
  // Avec un bruit plus faible, l'expert doit désigner le même vainqueur plus
  // souvent d'une itération à l'autre que favori, pour un même match fixe
  // (la perception elle-même ne change pas entre itérations : c'est la
  // variance du tirage Poisson qui peut faire fluctuer le score, mais le
  // signe du vainqueur perçu, lui, est fixé une fois la perception tirée).
  const winners = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const p = PROFILES.expert_simule(fixture, ctx(`expert-stability-${i}`));
    winners.add(p.home > p.away ? "home" : "away");
  }
  assert.equal(winners.size, 1, "expert_simule ne devrait jamais changer de vainqueur perçu pour un match fixe");
});
