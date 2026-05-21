// One-shot — supprime un utilisateur via l'Auth Admin API.
// Le DELETE SQL direct sur auth.users ne suffit pas : Supabase
// protège auth.users / auth.identities, et seul l'endpoint
// `auth.admin.deleteUser(id)` nettoie tout proprement.
//
// Usage : node scripts/delete-auth-user.js <email>

const fs = require("fs");
const path = require("path");

// Load .env.local
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
const email = (process.argv[2] || "").trim().toLowerCase();

if (!URL || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY dans .env.local");
  process.exit(1);
}
if (!email || !email.includes("@")) {
  console.error("Usage : node scripts/delete-auth-user.js <email>");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  // 1. Liste les users pour trouver l'id correspondant à l'email.
  //    listUsers est paginé : on cherche page par page jusqu'à le trouver.
  let target = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error("listUsers KO:", error.message);
      process.exit(1);
    }
    target = (data.users || []).find((u) => (u.email || "").toLowerCase() === email);
    if (target) break;
    if (!data.users || data.users.length < 200) break;
    page += 1;
    if (page > 50) break; // garde-fou
  }

  if (!target) {
    console.log(`Pas d'utilisateur auth trouvé pour ${email}. Rien à supprimer.`);
    // On nettoie quand même allowlist au cas où.
    await supabase.from("allowlist_users").delete().ilike("email", email);
    console.log("allowlist_users nettoyée.");
    process.exit(0);
  }

  console.log(`Cible trouvée : id=${target.id}, email=${target.email}`);

  const { error: delErr } = await supabase.auth.admin.deleteUser(target.id);
  if (delErr) {
    console.error("deleteUser KO:", delErr.message);
    process.exit(1);
  }
  console.log("✅ auth.users + auth.identities supprimés via Auth Admin API.");

  // Nettoyage de l'allowlist (pas de FK, donc à faire à la main).
  const { error: alErr } = await supabase
    .from("allowlist_users")
    .delete()
    .ilike("email", email);
  if (alErr) {
    console.error("allowlist KO:", alErr.message);
    process.exit(1);
  }
  console.log("✅ allowlist_users nettoyée.");
  console.log("Terminé.");
})();
