// Tests unitaires — orchestrateur Monte-Carlo (Lot 3C). Volumes réduits
// pour rester rapide ; la reproductibilité et la cohérence structurelle
// sont testées, pas la stabilité statistique fine (couverte par le rapport
// final à grande échelle, voir run-simulation.ts).

import { test } from "node:test";
import assert from "node:assert/strict";
import { runSimulation } from "./engine.ts";
import { BASELINE_0_3_2, SCHEME_1_3 } from "./scoring-schemes.ts";
import { PROFILE_KEYS } from "./profiles.ts";

const SMALL_CONFIG = {
  baseSeed: 42,
  replications: 6,
  usersPerProfile: 5,
  absenceRates: [0, 0.05, 0.1, 0.2],
  schemes: [BASELINE_0_3_2, SCHEME_1_3],
};

test("runSimulation: déterministe pour une même config", () => {
  const a = runSimulation(SMALL_CONFIG);
  const b = runSimulation(SMALL_CONFIG);
  assert.deepEqual(a, b);
});

test("runSimulation: un rapport par barème demandé, dans le même ordre", () => {
  const report = runSimulation(SMALL_CONFIG);
  assert.equal(report.perScheme.length, 2);
  assert.equal(report.perScheme[0].scheme.key, "baseline_0_3_2");
  assert.equal(report.perScheme[1].scheme.key, "scheme_1_3");
});

test("runSimulation: les 5 profils sont présents dans chaque rapport de barème", () => {
  const report = runSimulation(SMALL_CONFIG);
  for (const schemeReport of report.perScheme) {
    const profiles = schemeReport.perProfile.map((p) => p.profile).sort();
    assert.deepEqual(profiles, [...PROFILE_KEYS].sort());
  }
});

test("runSimulation: chaque profil a un échantillon de taille replications x usersPerProfile par taux d'absence", () => {
  const report = runSimulation(SMALL_CONFIG);
  const expectedN = SMALL_CONFIG.replications * SMALL_CONFIG.usersPerProfile;
  for (const schemeReport of report.perScheme) {
    for (const profileReport of schemeReport.perProfile) {
      for (const rateReport of profileReport.perAbsenceRate) {
        assert.equal(rateReport.summary.n, expectedN);
      }
    }
  }
});

test("runSimulation: un profil mieux informé (expert_simule) marque en moyenne plus qu'aléatoire, à 0% d'absence", () => {
  const report = runSimulation({ ...SMALL_CONFIG, replications: 30, usersPerProfile: 15 });
  for (const schemeReport of report.perScheme) {
    assert.ok(
      schemeReport.discriminationExpertVsAleatoire.meanA > schemeReport.discriminationExpertVsAleatoire.meanB,
      `expert_simule (${schemeReport.discriminationExpertVsAleatoire.meanA}) devrait dépasser aleatoire (${schemeReport.discriminationExpertVsAleatoire.meanB})`
    );
  }
});

test("runSimulation: augmenter le taux d'absence ne peut pas augmenter la moyenne de points d'un profil", () => {
  const report = runSimulation({ ...SMALL_CONFIG, replications: 20, usersPerProfile: 15 });
  for (const schemeReport of report.perScheme) {
    for (const profileReport of schemeReport.perProfile) {
      const means = profileReport.perAbsenceRate.map((r) => r.summary.mean);
      for (let i = 1; i < means.length; i++) {
        assert.ok(
          means[i] <= means[i - 1] + 5, // tolérance pour le bruit Monte-Carlo à volume réduit
          `la moyenne ne devrait pas augmenter significativement avec le taux d'absence pour ${profileReport.profile}`
        );
      }
    }
  }
});

test("runSimulation: fréquence de score exact toujours entre 0 et 1", () => {
  const report = runSimulation(SMALL_CONFIG);
  for (const schemeReport of report.perScheme) {
    for (const profileReport of schemeReport.perProfile) {
      assert.ok(profileReport.exactFrequency >= 0 && profileReport.exactFrequency <= 1);
    }
  }
});

test("runSimulation: 8 journées exposées, cohérent avec le calendrier réel", () => {
  const report = runSimulation(SMALL_CONFIG);
  assert.deepEqual(report.matchdays, [1, 2, 3, 4, 5, 6, 7, 8]);
});
