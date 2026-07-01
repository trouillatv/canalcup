// scripts/quiz-end.js — TERMINE immédiatement la (ou les) session(s) quiz active(s).
//
// À lancer depuis la racine du projet :   node scripts/quiz-end.js
//
// Lit .env.local pour NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
// Passe toute session non terminée en status='finished' (ended_at=now) → /quiz-live
// revient à l'écran d'attente et le mode Solo s'ouvre. N'efface AUCUN point.

const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants dans .env.local");
  process.exit(1);
}

const { createClient } = require("@supabase/supabase-js");
const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

(async () => {
  const { data, error } = await sb
    .from("quiz_session")
    .update({ ended_at: new Date().toISOString(), status: "finished" })
    .is("ended_at", null)
    .select("id");
  if (error) {
    console.error("❌ Erreur :", error.message);
    process.exit(1);
  }
  const n = data ? data.length : 0;
  console.log(n === 0 ? "✅ Aucune session active — rien à fermer." : `✅ ${n} session(s) quiz terminée(s).`);
  process.exit(0);
})();
