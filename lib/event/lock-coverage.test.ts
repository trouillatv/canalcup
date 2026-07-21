// Couverture du verrou de clôture — test STRUCTUREL. Exécuter : `npm test`
//
// Le risque réel n'est pas que le verrou soit mal écrit (ça, status-core.test.ts
// le couvre) : c'est qu'on ajoute une NOUVELLE route d'écriture dans six mois
// sans y penser. Le trou serait invisible — la route marcherait parfaitement,
// simplement elle laisserait encore écrire après la clôture.
//
// Ce test parcourt donc app/api et exige que TOUT handler d'écriture soit :
//   • soit protégé par competitionLock(),
//   • soit explicitement listé dans EXEMPTS avec sa raison.
// Ajouter une route sans choisir l'un des deux fait échouer `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const API_DIR = join(process.cwd(), "app", "api");

// Routes volontairement HORS verrou, avec la raison. Toute entrée ici est une
// décision assumée, pas un oubli.
const EXEMPTS: Record<string, string> = {
  "app/api/admin": "outils de correction des organisateurs — doivent rester ouverts après la clôture",
  "app/api/cron": "settlement et synchro automatiques — peuvent encore tourner",
  "app/api/auth": "connexion : rien à voir avec le jeu",
  "app/api/dev": "utilitaire de développement",
  "app/api/profile": "un joueur garde le droit de corriger son profil / fuseau",
  "app/api/inbox/read": "marquer une notification comme lue n'est pas une action de jeu",
  "app/api/track": "analytics de navigation (pages vues)",
  "app/api/push/subscribe": "abonnement aux notifications, pas une action de jeu",
  "app/api/push/send": "envoi piloté par l'orga",
};

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name === "route.ts") out.push(full);
  }
  return out;
}

const WRITE_HANDLER = /export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)\s*\(/;

test("toute route d'écriture est verrouillée à la clôture (ou exemptée explicitement)", () => {
  const files = walk(API_DIR);
  assert.ok(files.length > 20, "l'inventaire des routes n'a rien trouvé — chemin cassé ?");

  const unprotected: string[] = [];

  for (const file of files) {
    const rel = relative(process.cwd(), file).split(sep).join("/");
    const src = readFileSync(file, "utf8");

    if (!WRITE_HANDLER.test(src)) continue; // route en lecture seule
    if (Object.keys(EXEMPTS).some((prefix) => rel.startsWith(prefix))) continue;
    if (src.includes("competitionLock(")) continue;

    unprotected.push(rel);
  }

  assert.deepEqual(
    unprotected,
    [],
    `Routes d'écriture SANS verrou de clôture :\n  - ${unprotected.join(
      "\n  - "
    )}\n\nAjouter en tête du handler :\n  const locked = await competitionLock();\n  if (locked) return locked;\n\n…ou déclarer la route dans EXEMPTS (avec sa raison) si l'écriture doit survivre à la clôture.`
  );
});

test("chaque route verrouillée importe bien le helper (pas un appel fantôme)", () => {
  const offenders: string[] = [];
  for (const file of walk(API_DIR)) {
    const src = readFileSync(file, "utf8");
    if (!src.includes("competitionLock(")) continue;
    if (!/import\s*\{[^}]*competitionLock[^}]*\}\s*from/.test(src)) {
      offenders.push(relative(process.cwd(), file).split(sep).join("/"));
    }
  }
  assert.deepEqual(offenders, [], `competitionLock() appelé sans import : ${offenders.join(", ")}`);
});
