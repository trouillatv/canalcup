// One-shot — set une env var Vercel via l'API REST (le CLI interactif
// ne fonctionne pas via pipe dans certains shells Windows).
//
// Usage : node scripts/vercel-set-env.js KEY VALUE

const fs = require("fs");
const os = require("os");
const path = require("path");

// Vercel CLI stocke son token au format JSON dans %APPDATA%\xdg.data\com.vercel.cli\auth.json
const authPath = path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json");
const TOKEN = JSON.parse(fs.readFileSync(authPath, "utf8")).token;
const PROJECT = "canal-cup";

const [key, ...valueParts] = process.argv.slice(2);
const value = valueParts.join(" ");
if (!key || !value) {
  console.error("Usage : node scripts/vercel-set-env.js KEY VALUE");
  process.exit(1);
}

async function api(method, path, body) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

(async () => {
  // 1. List existing env vars and find any with same key+target=production.
  const list = await api("GET", `/v9/projects/${PROJECT}/env`);
  if (list.status !== 200) {
    console.error("LIST KO:", list.data);
    process.exit(1);
  }
  const existing = (list.data.envs || []).filter(
    (e) => e.key === key && (e.target || []).includes("production")
  );

  // 2. Delete existing
  for (const e of existing) {
    const del = await api("DELETE", `/v9/projects/${PROJECT}/env/${e.id}`);
    console.log(`Removed existing id=${e.id} → HTTP ${del.status}`);
  }

  // 3. Create new
  const create = await api("POST", `/v10/projects/${PROJECT}/env`, {
    key,
    value,
    type: "encrypted",
    target: ["production"],
  });
  if (create.status >= 400) {
    console.error("CREATE KO:", create.data);
    process.exit(1);
  }
  console.log(`✅ ${key} set (production), id=${create.data.created?.id || create.data.id}`);

  // 4. Verify
  const verify = await api("GET", `/v9/projects/${PROJECT}/env`);
  const fresh = (verify.data.envs || []).find(
    (e) => e.key === key && (e.target || []).includes("production")
  );
  if (fresh) {
    // value est censuré dans la liste, mais on a un id confirmé
    console.log(`Verified : id=${fresh.id}, type=${fresh.type}`);
  }
})();
