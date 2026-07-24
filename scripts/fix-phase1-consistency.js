/**
 * Phase 1 — correction des incohérences de données (idempotent).
 *
 *   node scripts/fix-phase1-consistency.js            → DRY-RUN (aucune écriture)
 *   node scripts/fix-phase1-consistency.js --apply    → applique
 *
 * Un snapshot JSON des lignes touchées est écrit AVANT toute écriture dans
 * scripts/snapshots/phase1-<horodatage>.json
 *
 * Ce que le script NE fait PAS, volontairement :
 *   - il ne supprime aucun événement de tirs au but (la timeline doit les
 *     afficher ; l'exclusion se fait à l'agrégation, cf. lib/football/goals.ts) ;
 *   - il ne touche à aucune date (elles sont correctes en UTC — l'écart avec les
 *     captures Sofascore est un décalage de fuseau +11 h) ;
 *   - il ne supprime aucun match de test (cf. étape 4).
 */
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const APPLY = process.argv.includes("--apply");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CANONICAL_COMPETITION = "FIFA World Cup 2026";
const changes = [];
const snapshot = [];

function plan(label, row, patch) {
  const diff = {};
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) diff[k] = { avant: row[k], apres: v };
  }
  if (!Object.keys(diff).length) {
    console.log(`   ✓ déjà conforme — ${label}`);
    return null;
  }
  console.log(`   → ${label}`);
  for (const [k, d] of Object.entries(diff)) {
    console.log(`        ${k.padEnd(16)} ${JSON.stringify(d.avant)}  →  ${JSON.stringify(d.apres)}`);
  }
  snapshot.push({ table: "matches", id: row.id, avant: row });
  changes.push({ table: "matches", id: row.id, patch });
  return patch;
}

(async () => {
  console.log(APPLY ? "=== MODE APPLY ===\n" : "=== DRY-RUN (aucune écriture) ===\n");

  const { data: matches, error } = await sb
    .from("matches")
    .select("id, competition, team_a, team_b, phase, status, score_a, score_b, score_reg_a, score_reg_b, score_ht_a, score_ht_b, pen_a, pen_b, minute, starts_at");
  if (error) throw error;

  // ── 1. Finale : encore 'live' 0-0 alors qu'elle est terminée 1-0 a.p.
  console.log("1) Finale Espagne–Argentine");
  const finale = matches.find(
    (m) => m.phase === "Finale" && m.team_a === "Espagne" && m.team_b === "Argentine"
  );
  if (!finale) {
    console.log("   ⚠ introuvable — étape ignorée");
  } else {
    plan(`${finale.team_a} ${finale.team_b} (${finale.id})`, finale, {
      status: "finished",
      score_a: 1,          // score final, après prolongation
      score_b: 0,
      score_reg_a: 0,      // temps réglementaire : 0-0 → les pronos KO sont jugés là-dessus
      score_reg_b: 0,
      score_ht_a: 0,       // mi-temps (joker Jet Lag)
      score_ht_b: 0,
      minute: 120,
    });
  }

  // ── 2. Allemagne–Paraguay : séance jouée mais pen_a/pen_b restés NULL.
  //     Ordre vérifié depuis match_events : home=Allemagne marque 3 (Kimmich,
  //     Musiala, Amiri), away=Paraguay marque 4 (Maurício, Gómez, Galarza,
  //     Canale). Paraguay se qualifie — confirmé par « Huitièmes Paraguay 0-1 France ».
  console.log("\n2) Allemagne–Paraguay : tirs au but manquants");
  const alPar = matches.find((m) => m.team_a === "Allemagne" && m.team_b === "Paraguay");
  if (!alPar) console.log("   ⚠ introuvable — étape ignorée");
  else plan(`${alPar.team_a} ${alPar.team_b} (${alPar.id})`, alPar, { pen_a: 3, pen_b: 4 });

  // ── 3. Libellé de compétition dédoublé.
  console.log("\n3) Libellé de compétition");
  const labels = {};
  for (const m of matches) labels[m.competition] = (labels[m.competition] ?? 0) + 1;
  for (const [lab, n] of Object.entries(labels).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${String(n).padStart(3)}  "${lab}"`);
  }
  const toRelabel = matches.filter((m) => m.competition === "Coupe du Monde 2026");
  console.log(`\n   → ${toRelabel.length} matchs à renommer en "${CANONICAL_COMPETITION}"`);
  for (const m of toRelabel) {
    snapshot.push({ table: "matches", id: m.id, avant: m });
    changes.push({ table: "matches", id: m.id, patch: { competition: CANONICAL_COMPETITION } });
  }

  // Contrainte dépendante : standings est unique(competition, group_name, team_name).
  const { data: st } = await sb.from("standings").select("competition, group_name, team_name");
  const stLabels = {};
  for (const s of st ?? []) stLabels[s.competition] = (stLabels[s.competition] ?? 0) + 1;
  console.log("   contrainte dépendante — standings unique(competition, group_name, team_name) :");
  for (const [lab, n] of Object.entries(stLabels)) console.log(`      ${String(n).padStart(3)}  "${lab}"`);
  const wouldCollide = new Set();
  const seen = new Set();
  for (const s of st ?? []) {
    const k = `${CANONICAL_COMPETITION}|${s.group_name}|${s.team_name}`;
    if (seen.has(k)) wouldCollide.add(k);
    seen.add(k);
  }
  console.log(
    wouldCollide.size
      ? `   ⛔ ${wouldCollide.size} collisions si on renomme standings — NE PAS renommer standings sans dédoublonnage`
      : "   ✓ aucune collision si standings était renommé (non fait par ce script)"
  );

  // ── 4. Matchs de test : pas de suppression, marquage.
  console.log("\n4) Matchs hors Coupe du Monde (tests / amicaux / simulations)");
  const nonWc = matches.filter(
    (m) => m.competition !== "Coupe du Monde 2026" && m.competition !== CANONICAL_COMPETITION
  );
  for (const m of nonWc) {
    console.log(`   [${m.status}] "${m.competition}" ${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}  id=${m.id}`);
  }
  const { error: probe } = await sb.from("matches").select("data_origin").limit(1);
  if (probe) {
    console.log(`\n   ⚠ colonne data_origin absente (${probe.message.split(".")[0]})`);
    console.log("   migration proposée (à exécuter via scripts/migrate.js) :");
    console.log(`
     alter table public.matches
       add column if not exists data_origin text not null default 'official_api'
       check (data_origin in ('official_api','reconstructed','simulation','test'));

     update public.matches set data_origin = 'test'
      where competition in ('Test - Coupe d''Europe','Ligue des Champions');
     update public.matches set data_origin = 'simulation'
      where competition = 'Amical international';
`);
    console.log("   → marquage NON appliqué (colonne inexistante). Aucune suppression.");
  } else {
    console.log("   ✓ colonne data_origin présente — marquage possible");
  }

  // ── Résumé + application
  console.log(`\n=== ${changes.length} écritures planifiées ===`);
  if (!changes.length) return console.log("Rien à faire.");

  if (!APPLY) {
    console.log("Dry-run terminé. Relancer avec --apply pour écrire.");
    return;
  }

  const dir = path.join(__dirname, "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapPath = path.join(dir, `phase1-${stamp}.json`);
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Snapshot écrit : ${snapPath}`);

  let ok = 0;
  for (const c of changes) {
    const { error: e } = await sb.from(c.table).update(c.patch).eq("id", c.id);
    if (e) console.error(`   ✖ ${c.id} : ${e.message}`);
    else ok++;
  }
  console.log(`${ok}/${changes.length} lignes mises à jour.`);
})();
