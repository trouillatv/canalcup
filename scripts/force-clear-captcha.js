// Reset complet : enabled=false + provider/secret vidés + toggle
// on→off pour forcer Supabase à recharger la conf gotrue.

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

function req(method, p, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = https.request(
      {
        hostname: "api.supabase.com",
        path: p,
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
  // 1. État avant
  let cur = await req("GET", `/v1/projects/${REF}/config/auth`);
  console.log("AVANT :", {
    enabled: cur.data.security_captcha_enabled,
    provider: cur.data.security_captcha_provider,
    secret: cur.data.security_captcha_secret ? "(set)" : null,
  });

  // 2. Tentative 1 : passer provider à null (peut être refusé selon
  //    l'API, on tente quand même).
  const a = await req("PATCH", `/v1/projects/${REF}/config/auth`, {
    security_captcha_enabled: false,
    security_captcha_provider: null,
    security_captcha_secret: null,
  });
  console.log(`PATCH 1 (null) → HTTP ${a.status}`);
  if (a.status >= 400) console.log(" body:", a.data);

  cur = await req("GET", `/v1/projects/${REF}/config/auth`);
  console.log("APRÈS PATCH 1 :", {
    enabled: cur.data.security_captcha_enabled,
    provider: cur.data.security_captcha_provider,
  });

  // 3. Tentative 2 : si provider est encore défini, on toggle
  //    enabled true→false pour forcer un rechargement gotrue.
  if (cur.data.security_captcha_provider) {
    console.log("Provider toujours défini, on toggle on/off…");
    await req("PATCH", `/v1/projects/${REF}/config/auth`, {
      security_captcha_enabled: true,
    });
    await new Promise((r) => setTimeout(r, 2000));
    await req("PATCH", `/v1/projects/${REF}/config/auth`, {
      security_captcha_enabled: false,
    });
    cur = await req("GET", `/v1/projects/${REF}/config/auth`);
    console.log("APRÈS toggle :", {
      enabled: cur.data.security_captcha_enabled,
      provider: cur.data.security_captcha_provider,
    });
  }
})();
