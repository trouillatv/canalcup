// One-shot — recalcule les Kamikaze déjà résolus avec le NOUVEAU barème :
//   • score EXACT            → +3 × mise
//   • bon résultat (vainqueur), score inexact → 0 (mise sauvée)
//   • mauvais résultat        → −mise
//
// Pourquoi : les Kamikaze réglés AVANT le changement de barème ont reçu −mise
// même pour un bon résultat (ancienne règle « exact ou rien »). Ce script
// corrige predictions.points_awarded ET joker_plays.metadata pour les matchs
// TERMINÉS uniquement.
//
// Sûr & idempotent : ne touche que les lignes dont le score recalculé DIFFÈRE.
// Dry-run par défaut ; écrit seulement avec --apply.
//
// Usage : node scripts/recompute-kamikaze.js            (dry-run, n'écrit rien)
//         node scripts/recompute-kamikaze.js --apply    (applique les corrections)

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const { createClient } = require("@supabase/supabase-js");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!URL || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}

const MULT = 3, MIN = 1, MAX = 20;
const sign = (a, b) => (a > b ? 1 : a < b ? -1 : 0);

const supabase = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  // 1. Tous les plays Kamikaze liés à un match
  const { data: plays, error: pErr } = await supabase
    .from("joker_plays")
    .select("id, played_by_user_id, match_id, status, metadata")
    .eq("joker_type", "kamikaze")
    .not("match_id", "is", null);
  if (pErr) { console.error("Lecture joker_plays KO:", pErr.message); process.exit(1); }
  if (!plays || !plays.length) { console.log("Aucun Kamikaze en base."); return; }

  const matchIds = [...new Set(plays.map((p) => p.match_id))];
  const userIds = [...new Set(plays.map((p) => p.played_by_user_id))];

  const [{ data: matches }, { data: users }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("id, status, score_a, score_b, team_a, team_b").in("id", matchIds),
    supabase.from("users").select("id, display_name, name").in("id", userIds),
    supabase.from("predictions").select("id, user_id, match_id, predicted_score_a, predicted_score_b, points_awarded").in("match_id", matchIds),
  ]);

  const matchById = new Map((matches ?? []).map((m) => [m.id, m]));
  const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"]));
  const predBy = new Map((preds ?? []).map((p) => [`${p.user_id}|${p.match_id}`, p]));

  let changed = 0, skipped = 0;
  for (const play of plays) {
    const m = matchById.get(play.match_id);
    const who = nameById.get(play.played_by_user_id);
    if (!m || m.status !== "finished" || m.score_a == null || m.score_b == null) { skipped++; continue; }

    const stakeRaw = Number(play.metadata?.stake);
    const stake = Number.isFinite(stakeRaw) ? Math.max(MIN, Math.min(MAX, Math.round(stakeRaw))) : 0;
    const pred = predBy.get(`${play.played_by_user_id}|${play.match_id}`);

    let newPoints, tier;
    if (!pred || pred.predicted_score_a == null || pred.predicted_score_b == null || stake <= 0) {
      tier = "no_pred"; newPoints = null;
    } else {
      const exact = pred.predicted_score_a === m.score_a && pred.predicted_score_b === m.score_b;
      const good = sign(pred.predicted_score_a, pred.predicted_score_b) === sign(m.score_a, m.score_b);
      newPoints = exact ? MULT * stake : good ? 0 : -stake;
      tier = exact ? "exact" : good ? "result" : "miss";
    }

    if (newPoints === null || !pred) { skipped++; continue; }

    const oldPoints = pred.points_awarded ?? 0;
    if (oldPoints === newPoints) { skipped++; continue; }

    console.log(
      `${who} — ${m.team_a}–${m.team_b} (${m.score_a}-${m.score_b}) | prono ${pred.predicted_score_a}-${pred.predicted_score_b} mise ${stake} | ${oldPoints} → ${newPoints} [${tier}]`
    );

    if (APPLY) {
      const { error: e1 } = await supabase.from("predictions").update({ points_awarded: newPoints }).eq("id", pred.id);
      if (e1) { console.error("  ✗ update prediction KO:", e1.message); continue; }
      const { error: e2 } = await supabase
        .from("joker_plays")
        .update({ status: "consumed", metadata: { ...(play.metadata || {}), resolved: true, points: newPoints, tier, stake } })
        .eq("id", play.id);
      if (e2) console.error("  ✗ update joker_play KO:", e2.message);
    }
    changed++;
  }

  console.log(`\n${APPLY ? "✅ Appliqué" : "[dry-run]"} : ${changed} correction(s), ${skipped} inchangé(s)/ignoré(s).`);
  if (!APPLY && changed > 0) console.log("→ relance avec --apply pour écrire.");
})();
