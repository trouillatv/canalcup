/**
 * Settlement des bonus `winner` et `top_scorer` (idempotent).
 *
 *   node scripts/settle-bonus-predictions.js           → DRY-RUN
 *   node scripts/settle-bonus-predictions.js --apply   → applique
 *
 * Il n'existe aucun settlement automatique pour ces deux bonus : settle.ts ne
 * traite que `perfect_streak`. D'où ce script.
 *
 * Résultats CdM 2026 :
 *   - vainqueur       : Espagne (1-0 a.p. sur l'Argentine, Ferran Torres 106')
 *   - meilleur buteur : Kylian Mbappé (10 buts)
 *
 * Barème (app/predictions/page.tsx) : winner +20, top_scorer +10.
 *
 * Les valeurs saisies sont du texte libre : on compare sur un nom normalisé
 * (sans accents/casse/ponctuation) et, pour le buteur, sur le nom de famille —
 * « Mbappé » et « Kylian Mbappé » doivent tous deux compter.
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

const POINTS = { winner: 20, top_scorer: 10 };
const WINNER = "Espagne";
const TOP_SCORER_LASTNAME = "mbappe";

const norm = (s) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function isWinnerOk(v) {
  return norm(v) === norm(WINNER);
}
function isScorerOk(v) {
  // « Mbappé », « Kylian Mbappé », « K. Mbappe »… → tous acceptés
  return norm(v).includes(TOP_SCORER_LASTNAME);
}

(async () => {
  console.log(APPLY ? "=== MODE APPLY ===\n" : "=== DRY-RUN (aucune écriture) ===\n");

  const { data: preds, error } = await sb
    .from("bonus_predictions")
    .select("id, user_id, prediction_type, predicted_value, points_awarded")
    .in("prediction_type", ["winner", "top_scorer"]);
  if (error) throw error;

  const { data: users } = await sb.from("users").select("id, display_name, name, email");
  const byId = new Map((users ?? []).map((u) => [u.id, u]));
  const nameOf = (id) => {
    const u = byId.get(id) ?? {};
    return u.display_name || u.name || u.email || id;
  };

  const changes = [];
  const snapshot = [];

  for (const type of ["winner", "top_scorer"]) {
    const label = type === "winner" ? `vainqueur = ${WINNER}` : "meilleur buteur = Kylian Mbappé";
    console.log(`── ${type} (${label}) — +${POINTS[type]} pts`);
    const rows = preds.filter((p) => p.prediction_type === type);
    for (const p of rows.sort((a, b) => nameOf(a.user_id).localeCompare(nameOf(b.user_id), "fr"))) {
      const ok = type === "winner" ? isWinnerOk(p.predicted_value) : isScorerOk(p.predicted_value);
      const attendu = ok ? POINTS[type] : 0;
      const actuel = p.points_awarded ?? 0;
      const flag = actuel !== attendu ? `  ◄ ${actuel} → ${attendu}` : "";
      console.log(`   ${ok ? "✅" : "❌"} ${nameOf(p.user_id).slice(0, 24).padEnd(25)} "${p.predicted_value}"${flag}`);
      if (actuel !== attendu) {
        snapshot.push({ id: p.id, user: nameOf(p.user_id), type, valeur: p.predicted_value, avant: actuel, apres: attendu });
        changes.push({ id: p.id, points_awarded: attendu });
      }
    }
    console.log("");
  }

  console.log(`=== ${changes.length} lignes à mettre à jour ===`);
  if (!changes.length) return console.log("Déjà conforme, rien à faire.");

  if (!APPLY) return console.log("Dry-run terminé. Relancer avec --apply pour écrire.");

  const dir = path.join(__dirname, "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const snapPath = path.join(dir, `bonus-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(snapPath, JSON.stringify(snapshot, null, 2), "utf8");
  console.log(`Snapshot : ${snapPath}`);

  let ok = 0;
  for (const c of changes) {
    const { error: e } = await sb
      .from("bonus_predictions")
      .update({ points_awarded: c.points_awarded })
      .eq("id", c.id);
    if (e) console.error(`   ✖ ${c.id} : ${e.message}`);
    else ok++;
  }
  console.log(`${ok}/${changes.length} lignes mises à jour.`);
})();
