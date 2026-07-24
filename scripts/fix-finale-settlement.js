/**
 * Correction du settlement de la finale Espagne–Argentine (idempotent).
 *
 *   node scripts/fix-finale-settlement.js           → DRY-RUN (aucune écriture)
 *   node scripts/fix-finale-settlement.js --apply   → applique
 *
 * ── Pourquoi ce script existe ────────────────────────────────────────────────
 * La finale a été settlée alors que `score_reg_a/b` était null. Or
 * regulationScore() (lib/scoring.ts:48) retombe sur `score_a ?? null` : les
 * pronos ont donc été jugés sur le 1-0 APRÈS PROLONGATION au lieu du 0-0 du
 * temps réglementaire, contrairement à la règle du projet (phase finale jugée
 * au temps réglementaire, prolongation et TAB exclus).
 *
 * `score_reg` a depuis été corrigé à 0-0 par fix-phase1-consistency.js, mais
 * corriger le score ne recalcule rien rétroactivement : les points restent faux.
 *
 * ── Pourquoi PAS un simple re-run de settleMatch() ───────────────────────────
 * Les résolveurs de jokers filtrent sur `status = 'active'` et sortent
 * immédiatement si rien ne remonte. Les jokers de la finale sont déjà
 * `consumed` : un re-run recalculerait les points de base mais n'appliquerait
 * plus AUCUN override de joker — les parieurs perdraient leur ajustement.
 * D'où cette reprise ciblée, qui réapplique explicitement les deux barèmes.
 *
 * ── Périmètre exact (inventorié en base le 20/07/2026) ───────────────────────
 * 5 jokers sur la finale, tous `consumed` :
 *   - 3 VAR (Mo', Jpréfèrlehockey, Kriss) → simples fenêtres de modification,
 *     n'attribuent aucun point : RIEN à reprendre.
 *   - 2 Kamikaze (Kriss, Hélène), mise 20 chacun, résolus `tier: miss` (−20).
 * Aucun Quitte ou Double, aucun Jet Lag sur ce match.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APPLY = process.argv.includes("--apply");
const MATCH_ID = "4e83cce3-333b-4e84-a931-824c7f50ef9b";

// Barème — miroir de lib/scoring.ts et lib/jokers/catalog.ts.
const PHASE_MULTIPLIERS = { Finale: 3, Final: 3 };
const KAMIKAZE_WIN_MULTIPLIER = 3;
const KAMIKAZE_MAX_STAKE = 20;

const sign = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

function basePoints(pa, pb, aa, ab, phase) {
  const mult = PHASE_MULTIPLIERS[phase] ?? 1;
  if (pa === aa && pb === ab) return Math.round(10 * mult);
  if (sign(pa, pb) === sign(aa, ab)) return Math.round(5 * mult);
  if (pa - pb === aa - ab) return Math.round(3 * mult);
  return 0;
}

(async () => {
  console.log(APPLY ? "=== APPLICATION ===\n" : "=== DRY-RUN (aucune écriture) ===\n");

  const { data: match, error: mErr } = await sb
    .from("matches")
    .select("id, team_a, team_b, phase, status, score_a, score_b, score_reg_a, score_reg_b")
    .eq("id", MATCH_ID)
    .single();
  if (mErr) throw mErr;

  const aa = match.score_reg_a;
  const ab = match.score_reg_b;
  if (aa == null || ab == null) {
    console.error("✗ score_reg absent : lance d'abord scripts/fix-phase1-consistency.js --apply");
    process.exit(1);
  }
  console.log(`${match.team_a} ${match.score_a}-${match.score_b} ${match.team_b} (final)`);
  console.log(`Temps réglementaire retenu pour juger : ${aa}-${ab}`);
  console.log(`Phase « ${match.phase} » → multiplicateur ×${PHASE_MULTIPLIERS[match.phase] ?? 1}\n`);

  const { data: preds } = await sb
    .from("predictions")
    .select("id, user_id, predicted_score_a, predicted_score_b, points_awarded")
    .eq("match_id", MATCH_ID);
  const { data: users } = await sb.from("users").select("id, display_name, name, email");
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  const nom = (id) => {
    const u = byId.get(id) ?? {};
    return u.display_name || u.name || u.email || String(id).slice(0, 8);
  };

  // Kamikazes de ce match, quel que soit leur status (ils sont déjà consumed).
  const { data: kamis } = await sb
    .from("joker_plays")
    .select("id, played_by_user_id, metadata")
    .eq("joker_type", "kamikaze")
    .eq("match_id", MATCH_ID);
  const kamiByUser = new Map((kamis ?? []).map((k) => [k.played_by_user_id, k]));

  // Garde-fou : si un jour un Quitte ou Double ou un Jet Lag apparaît sur ce
  // match, ce script ne sait pas le reprendre — on refuse plutôt que d'écraser.
  const { data: autres } = await sb
    .from("joker_plays")
    .select("joker_type")
    .eq("match_id", MATCH_ID)
    .in("joker_type", ["quitte_ou_double", "retard_avion"]);
  if (autres?.length) {
    console.error(`✗ ${autres.length} joker(s) non gérés sur ce match (${autres.map((a) => a.joker_type).join(", ")}). Abandon.`);
    process.exit(1);
  }

  const predUpdates = [];
  const kamiUpdates = [];
  const rows = [];

  for (const p of preds ?? []) {
    const pa = p.predicted_score_a;
    const pb = p.predicted_score_b;
    if (pa == null || pb == null) continue;

    let cible = basePoints(pa, pb, aa, ab, match.phase);
    let via = "prono";

    const kami = kamiByUser.get(p.user_id);
    if (kami) {
      const raw = Number(kami.metadata?.stake);
      const stake = Number.isFinite(raw) ? Math.max(1, Math.min(KAMIKAZE_MAX_STAKE, Math.round(raw))) : 0;
      if (stake > 0) {
        const exact = pa === aa && pb === ab;
        const bon = sign(pa, pb) === sign(aa, ab);
        // Exact = +3×mise ; bon résultat = 0 (mise sauvée) ; sinon −mise.
        cible = exact ? KAMIKAZE_WIN_MULTIPLIER * stake : bon ? 0 : -stake;
        const tier = exact ? "exact" : bon ? "result" : "miss";
        via = `kamikaze/${tier} (mise ${stake})`;
        if (kami.metadata?.tier !== tier || kami.metadata?.points !== cible) {
          kamiUpdates.push({
            id: kami.id,
            nom: nom(p.user_id),
            avant: `${kami.metadata?.tier} / ${kami.metadata?.points} pts`,
            apres: `${tier} / ${cible} pts`,
            metadata: { ...(kami.metadata ?? {}), resolved: true, points: cible, tier, stake },
          });
        }
      }
    }

    const change = cible !== p.points_awarded;
    if (change) predUpdates.push({ id: p.id, points_awarded: cible });
    rows.push({
      nom: nom(p.user_id),
      prono: `${pa}-${pb}`,
      avant: p.points_awarded,
      apres: cible,
      via,
      change,
    });
  }

  rows.sort((a, b) => (b.apres - b.avant) - (a.apres - a.avant));
  console.log("joueur".padEnd(22), "prono", "avant".padStart(6), "après".padStart(7), "  via");
  console.log("─".repeat(72));
  for (const r of rows) {
    console.log(
      r.nom.slice(0, 21).padEnd(22),
      r.prono.padEnd(5),
      String(r.avant).padStart(6),
      String(r.apres).padStart(7),
      "  " + r.via,
      r.change ? "  ◄" : ""
    );
  }

  const deltaTotal = rows.reduce((s, r) => s + (r.apres - r.avant), 0);
  console.log("─".repeat(72));
  console.log(`\n${predUpdates.length}/${rows.length} pronos à corriger — variation nette : ${deltaTotal >= 0 ? "+" : ""}${deltaTotal} pts`);

  if (kamiUpdates.length) {
    console.log(`\n${kamiUpdates.length} kamikaze(s) à re-résoudre :`);
    for (const k of kamiUpdates) console.log(`  ${k.nom.padEnd(20)} ${k.avant}  →  ${k.apres}`);
  }

  if (!predUpdates.length && !kamiUpdates.length) {
    console.log("\nDéjà conforme, rien à faire.");
    return;
  }

  if (!APPLY) {
    console.log("\n(dry-run — relance avec --apply pour écrire)");
    return;
  }

  // Snapshot AVANT toute écriture.
  const dir = path.join(ROOT, "scripts", "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snap = path.join(dir, `finale-settlement-${stamp}.json`);
  fs.writeFileSync(snap, JSON.stringify({ match, predictions: preds, kamikazes: kamis }, null, 2));
  console.log(`\nSnapshot : ${path.relative(ROOT, snap)}`);

  for (const u of predUpdates) {
    const { error } = await sb.from("predictions").update({ points_awarded: u.points_awarded }).eq("id", u.id);
    if (error) throw error;
  }
  console.log(`✅ ${predUpdates.length} pronos mis à jour`);

  for (const k of kamiUpdates) {
    const { error } = await sb.from("joker_plays").update({ metadata: k.metadata }).eq("id", k.id);
    if (error) throw error;
  }
  if (kamiUpdates.length) console.log(`✅ ${kamiUpdates.length} kamikaze(s) re-résolu(s)`);

  console.log("\nRelance sans --apply pour vérifier l'idempotence.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
