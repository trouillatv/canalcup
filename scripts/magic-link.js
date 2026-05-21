// One-shot — génère un lien magique de connexion via Auth Admin API
// pour contourner le formulaire signin (utile si captcha cassé,
// password oublié, etc.). Le lien est valable une seule fois.
//
// Usage : node scripts/magic-link.js <email>

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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3001";
const email = (process.argv[2] || "").trim().toLowerCase();

if (!URL || !SERVICE) { console.error("env manquantes"); process.exit(1); }
if (!email || !email.includes("@")) {
  console.error("Usage : node scripts/magic-link.js <email>");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${APP_URL}/auth/callback` },
  });
  if (error) { console.error("generateLink KO:", error.message); process.exit(1); }
  const link = data.properties?.action_link;
  if (!link) { console.error("Pas de action_link dans la réponse:", data); process.exit(1); }
  console.log("\n🔗 Lien magique (à ouvrir UNE fois dans le navigateur) :\n");
  console.log(link);
  console.log("\nValable peu de temps. Ouvre-le et tu seras connecté.\n");
})();
