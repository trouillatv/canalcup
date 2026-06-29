// One-shot — rembourse la VAR gâchée de Pegase (1a4345e9...).
// Contexte : le 29/06 LaVARe l'a brouillardé (17:54), Pegase a ensuite joué sa
// VAR (18:04, match be6258fb) qui n'a pas pu servir (verrou Brouillard).
// On lui rend +1 VAR. Idempotent : on marque la VAR consommée concernée
// (joker_plays.metadata.refunded) et on refuse de rembourser deux fois.
// Usage : node scripts/refund-pegase-var.js
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
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const PEGASE = "1a4345e9-f7d8-451d-b53d-9d580d108be1";

(async () => {
  // 1. Retrouve la VAR consommée gâchée (la plus récente jouée par Pegase).
  const { data: plays } = await sb
    .from("joker_plays")
    .select("id, match_id, status, metadata, effect_starts_at")
    .eq("played_by_user_id", PEGASE)
    .eq("joker_type", "var")
    .order("effect_starts_at", { ascending: false });
  const play = (plays ?? [])[0];
  if (!play) { console.log("❌ Aucune VAR jouée par Pegase trouvée."); return; }
  console.log(`VAR repérée : play ${play.id} | match ${String(play.match_id).slice(0,8)} | ${play.effect_starts_at}`);

  if (play.metadata && play.metadata.refunded) {
    console.log("⏭  Déjà remboursé (marqueur présent sur la VAR). Aucune action.");
    return;
  }

  // 2. +1 sur le wallet VAR de Pegase.
  const { data: w } = await sb
    .from("joker_wallets")
    .select("id, quantity")
    .eq("user_id", PEGASE)
    .eq("joker_type", "var")
    .maybeSingle();
  if (w) {
    await sb.from("joker_wallets")
      .update({ quantity: (w.quantity || 0) + 1, updated_at: new Date().toISOString() })
      .eq("id", w.id);
    console.log(`✅ VAR remboursée : ${w.quantity} → ${(w.quantity || 0) + 1}`);
  } else {
    await sb.from("joker_wallets").insert({ user_id: PEGASE, joker_type: "var", quantity: 1 });
    console.log("✅ VAR créée à 1 (wallet absent).");
  }

  // 3. Marque la VAR comme remboursée (anti-double).
  await sb.from("joker_plays")
    .update({ metadata: { ...(play.metadata || {}), refunded: true, refund_reason: "VAR annulée par Brouillard (29/06)" } })
    .eq("id", play.id);
  console.log("🔖 Marqueur de remboursement posé.");
})();
