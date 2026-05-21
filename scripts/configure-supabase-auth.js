// One-shot — configure tous les paramètres Supabase Auth via la
// Management API en une seule passe :
//   1. mailer_autoconfirm = false  → "Confirm email" activé
//   2. site_url = URL prod
//   3. uri_allow_list = URLs prod + dev autorisées comme redirectTo
//   4. mailer_subjects_confirmation = "Active ton compte Canal Cup ⚽"
//   5. mailer_templates_confirmation_content = template HTML Canal Cup
//
// Usage : node scripts/configure-supabase-auth.js [prodUrl]
//   prodUrl défaut: https://canal-cup.vercel.app

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
const PROD = (process.argv[2] || "https://canal-cup.vercel.app").replace(/\/$/, "");

if (!PAT || !REF) { console.error("env manquantes"); process.exit(1); }

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

const CONFIRM_SUBJECT = "Active ton compte Canal Cup ⚽";

// Template HTML — Supabase remplace {{ .ConfirmationURL }} par le lien.
// Le sujet et le corps sont en HTML simple, inline-styled pour
// fonctionner dans tous les clients mail.
const CONFIRM_BODY = `<!DOCTYPE html>
<html lang="fr">
<body style="margin:0;padding:0;background:#0D0B08;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0D0B08">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="480" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;background:#1A1814;border:1px solid #2A2820;border-radius:16px">
          <tr>
            <td style="padding:32px 28px;text-align:center">
              <p style="margin:0 0 8px 0;font-size:36px;font-weight:900;letter-spacing:-1px">
                <span style="color:#FFCC00">CANAL</span><span style="color:#fff">CUP</span>
                <span style="color:#888;font-size:24px">2026</span>
              </p>
              <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:3px;color:#FFCC00;text-transform:uppercase">Le tournoi Canal+ NC</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 24px 28px">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:900;color:#fff">Active ton compte ⚽</h1>
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#C8C5BE">
                Bienvenue sur Canal Cup ! Plus qu'une étape pour rejoindre l'aventure : confirme ton email en cliquant ci-dessous.
              </p>
              <p style="text-align:center;margin:0 0 24px 0">
                <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#FFCC00;color:#0D0B08;padding:14px 32px;border-radius:12px;text-decoration:none;font-weight:900;font-size:15px">
                  Confirmer mon email →
                </a>
              </p>
              <p style="margin:0 0 8px 0;font-size:12px;color:#888;line-height:1.6">
                Si le bouton ne marche pas, copie ce lien dans ton navigateur :
              </p>
              <p style="margin:0 0 24px 0;font-size:11px;color:#FFCC00;word-break:break-all;font-family:monospace">
                {{ .ConfirmationURL }}
              </p>
              <p style="margin:0;font-size:12px;color:#666;line-height:1.6;border-top:1px solid #2A2820;padding-top:16px">
                Si tu n'as pas demandé ce compte, ignore cet email — il expire automatiquement.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px;background:#0D0B08;border-radius:0 0 16px 16px;text-align:center">
              <p style="margin:0;font-size:11px;color:#666">
                Canal Cup 2026 — RSE Canal+ Nouvelle-Calédonie
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

(async () => {
  console.log(`Projet : ${REF}`);
  console.log(`URL prod cible : ${PROD}`);
  console.log("");

  // 1. État avant
  const before = await req("GET", `/v1/projects/${REF}/config/auth`);
  if (before.status !== 200) {
    console.error("GET KO:", before.data); process.exit(1);
  }
  console.log("AVANT :");
  console.log(" mailer_autoconfirm    :", before.data.mailer_autoconfirm);
  console.log(" site_url              :", before.data.site_url);
  console.log(" uri_allow_list        :", before.data.uri_allow_list);
  console.log(" mailer_subjects_confirmation :", before.data.mailer_subjects_confirmation);
  console.log("");

  // 2. Construit la liste d'URLs autorisées (prod + localhost dev).
  //    On garde l'existant ET on ajoute les nôtres pour ne rien casser.
  const existing = (before.data.uri_allow_list || "").split(",").map((s) => s.trim()).filter(Boolean);
  const wanted = [
    `${PROD}/auth/callback`,
    `${PROD}/auth/reset-password`,
    `${PROD}/`,
    "http://localhost:3000/auth/callback",
    "http://localhost:3000/auth/reset-password",
    "http://localhost:3001/auth/callback",
    "http://localhost:3001/auth/reset-password",
  ];
  const merged = Array.from(new Set([...existing, ...wanted]));

  // 3. PATCH
  const patch = await req("PATCH", `/v1/projects/${REF}/config/auth`, {
    mailer_autoconfirm: false,          // = "Confirm email" activé
    site_url: PROD,
    uri_allow_list: merged.join(","),
    mailer_subjects_confirmation: CONFIRM_SUBJECT,
    mailer_templates_confirmation_content: CONFIRM_BODY,
  });
  if (patch.status >= 400) {
    console.error(`PATCH KO (HTTP ${patch.status}) :`, patch.data);
    process.exit(1);
  }

  // 4. Vérification
  const after = await req("GET", `/v1/projects/${REF}/config/auth`);
  console.log("APRÈS :");
  console.log(" mailer_autoconfirm    :", after.data.mailer_autoconfirm);
  console.log(" site_url              :", after.data.site_url);
  console.log(" uri_allow_list        :", after.data.uri_allow_list);
  console.log(" mailer_subjects_confirmation :", after.data.mailer_subjects_confirmation);
  console.log("");
  console.log("✅ Config Supabase Auth appliquée.");
})();
