// One-shot — reset le password d'un utilisateur via l'Auth Admin API.
// Utile quand Vincent est locked out après changement de config Supabase
// (captcha, etc.) — on contourne sans passer par le flow "mot de passe
// oublié" qui exige un email reçu.
//
// Usage : node scripts/reset-password.js <email> <newPassword>

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
const email = (process.argv[2] || "").trim().toLowerCase();
const newPwd = process.argv[3] || "";

if (!URL || !SERVICE) {
  console.error("Manque NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
if (!email || !email.includes("@") || !newPwd) {
  console.error("Usage : node scripts/reset-password.js <email> <newPassword>");
  process.exit(1);
}
if (newPwd.length < 8) {
  console.error("Mot de passe : 8 caractères min.");
  process.exit(1);
}

const supabase = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

(async () => {
  let target = null;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) { console.error("listUsers KO:", error.message); process.exit(1); }
    target = (data.users || []).find((u) => (u.email || "").toLowerCase() === email);
    if (target) break;
    if (!data.users || data.users.length < 200) break;
    page += 1;
    if (page > 50) break;
  }

  if (!target) {
    console.error(`Pas d'utilisateur trouvé pour ${email}.`);
    process.exit(1);
  }

  console.log(`Cible : id=${target.id}, email=${target.email}`);

  const { error } = await supabase.auth.admin.updateUserById(target.id, {
    password: newPwd,
  });
  if (error) {
    console.error("updateUserById KO:", error.message);
    process.exit(1);
  }
  console.log(`✅ Password reset pour ${email}.`);
})();
