// One-shot — désactive la protection captcha sur Supabase Auth via
// la Management API. Le captcha bloquait toutes les tentatives auth
// avec 'sitekey-secret-mismatch' parce que notre code client n'envoie
// pas de captcha token (RSE interne, inutile).
//
// Usage : node scripts/disable-supabase-captcha.js

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
  console.error("Manque SUPABASE_PAT ou NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request(
      {
        hostname: "api.supabase.com",
        path,
        method,
        headers: {
          Authorization: `Bearer ${PAT}`,
          "Content-Type": "application/json",
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(chunks); } catch { parsed = chunks; }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  console.log(`Projet : ${REF}`);

  // 1. Lit la config actuelle.
  const cur = await req("GET", `/v1/projects/${REF}/config/auth`);
  if (cur.status !== 200) {
    console.error(`GET config KO (HTTP ${cur.status}) :`, cur.data);
    process.exit(1);
  }
  console.log("Captcha actuellement :", {
    enabled: cur.data.security_captcha_enabled,
    provider: cur.data.security_captcha_provider,
  });

  // 2. Désactive.
  const patch = await req("PATCH", `/v1/projects/${REF}/config/auth`, {
    security_captcha_enabled: false,
  });
  if (patch.status >= 400) {
    console.error(`PATCH KO (HTTP ${patch.status}) :`, patch.data);
    process.exit(1);
  }
  console.log("✅ Captcha désactivé.");

  // 3. Re-lit pour confirmer.
  const after = await req("GET", `/v1/projects/${REF}/config/auth`);
  console.log("Après :", {
    enabled: after.data.security_captcha_enabled,
    provider: after.data.security_captcha_provider,
  });

  console.log("Tu peux retenter de te connecter maintenant.");
})();
