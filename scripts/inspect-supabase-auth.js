// Diagnostic : affiche TOUTE la config auth Supabase pour voir d'où
// peut venir un sitekey-secret-mismatch persistant.

const https = require("https");
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const PAT = process.env.SUPABASE_PAT;
const REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)/)?.[1];

if (!PAT || !REF) {
  console.error("env manquantes");
  process.exit(1);
}

https
  .request(
    {
      hostname: "api.supabase.com",
      path: `/v1/projects/${REF}/config/auth`,
      method: "GET",
      headers: { Authorization: `Bearer ${PAT}` },
    },
    (res) => {
      let chunks = "";
      res.on("data", (c) => (chunks += c));
      res.on("end", () => {
        const d = JSON.parse(chunks);
        const captcha = Object.fromEntries(
          Object.entries(d).filter(([k]) => k.toLowerCase().includes("captcha"))
        );
        console.log("Tous les champs captcha :");
        console.log(JSON.stringify(captcha, null, 2));
      });
    }
  )
  .end();
