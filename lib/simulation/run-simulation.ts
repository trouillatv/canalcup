// Point d'entrée du simulateur Lot 3C — exécute la Monte-Carlo à pleine
// échelle et écrit un rapport JSON local. AUCUNE écriture Supabase, aucun
// accès réseau : entièrement local et déterministe (voir engine.ts).
//
// Usage : node lib/simulation/run-simulation.ts

import { writeFileSync } from "node:fs";
import { runSimulation } from "./engine.ts";
import { ALL_SCHEMES } from "./scoring-schemes.ts";

const config = {
  baseSeed: 42,
  replications: 300,
  usersPerProfile: 30,
  absenceRates: [0, 0.05, 0.1, 0.2],
  schemes: ALL_SCHEMES,
};

const t0 = Date.now();
const report = runSimulation(config);
const elapsedMs = Date.now() - t0;

const outPath = new URL("../../docs/lot3c-simulation-report.json", import.meta.url);
writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`Simulation terminée en ${elapsedMs}ms.`);
console.log(`Rapport écrit dans ${outPath.pathname.replace(/^\//, "")}`);
console.log("");
console.log("Résumé (0% absence) :");
for (const schemeReport of report.perScheme) {
  console.log(`\n=== ${schemeReport.scheme.label} (${schemeReport.scheme.key}) ===`);
  console.log(`Médiane globale (tous profils mêlés) : ${schemeReport.overallMedianAtZeroAbsence}`);
  console.log(
    `Discrimination expert_simule vs aleatoire : gap=${schemeReport.discriminationExpertVsAleatoire.gap.toFixed(1)} pts, Cohen's d=${schemeReport.discriminationExpertVsAleatoire.cohensD.toFixed(2)}`
  );
  console.log(`Taux d'égalité au classement (0% absence) : ${(schemeReport.tieRateAtZeroAbsence * 100).toFixed(1)}%`);
  for (const p of schemeReport.perProfile) {
    const zero = p.perAbsenceRate[0];
    console.log(
      `  ${p.profile.padEnd(14)} mean=${zero.summary.mean.toFixed(1).padStart(6)} median=${String(zero.summary.median).padStart(5)} stdDev=${zero.summary.stdDev.toFixed(1).padStart(6)} exactFreq=${(p.exactFrequency * 100).toFixed(1)}% exactShare=${(p.pointShare.exactShare * 100).toFixed(1)}%`
    );
  }
}
