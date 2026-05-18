// Migration runner — usage: node scripts/migrate.js "SQL QUERY"
// Uses Supabase Management API with PAT from SUPABASE_PAT env var or .env.local

const https = require("https");
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

const PAT = process.env.SUPABASE_PAT;
const URL_MATCH = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)/);
const REF = URL_MATCH ? URL_MATCH[1] : null;

if (!PAT || !REF) {
  console.error("SUPABASE_PAT and NEXT_PUBLIC_SUPABASE_URL required in .env.local");
  process.exit(1);
}

// IMPORTANT (Windows) : ne JAMAIS passer du SQL accenté en argument de ligne
// de commande — le code page console corrompt le non-ASCII en U+FFFD avant
// que Node le voie (cf. corruption des questions quiz, 2026-05). Pour tout
// SQL contenant des accents, utiliser le mode fichier qui lit en UTF-8 :
//   node scripts/migrate.js --file supabase/seed_quiz_worldcup.sql
const args = process.argv.slice(2);
let query;
if (args[0] === "--file" || args[0] === "-f") {
  const sqlPath = args[1] && path.isAbsolute(args[1])
    ? args[1]
    : path.join(process.cwd(), args[1] || "");
  if (!args[1] || !fs.existsSync(sqlPath)) {
    console.error("Fichier SQL introuvable:", args[1]);
    process.exit(1);
  }
  query = fs.readFileSync(sqlPath, "utf8");
} else {
  query = args.join(" ");
}
if (!query) {
  console.error('Usage: node scripts/migrate.js "ALTER TABLE ..."');
  console.error('   ou: node scripts/migrate.js --file chemin/vers/fichier.sql  (recommandé si accents)');
  process.exit(1);
}

const body = JSON.stringify({ query });
const options = {
  hostname: "api.supabase.com",
  path: `/v1/projects/${REF}/database/query`,
  method: "POST",
  headers: {
    Authorization: `Bearer ${PAT}`,
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    const result = JSON.parse(data || "[]");
    if (result.message) {
      console.error("❌", result.message);
      process.exit(1);
    }
    console.log("✅ Done:", JSON.stringify(result));
  });
});
req.on("error", (e) => { console.error(e); process.exit(1); });
req.write(body);
req.end();
