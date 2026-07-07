// Backup DB — export JSON restaurable de toutes les tables publiques.
// Usage : node scripts/backup-db.js
// Réutilise la Management API Supabase (PAT) comme migrate.js — pas de limite
// 1000 lignes, SELECT * ramène toutes les lignes.
//
// Sortie : backups/canalcup-YYYY-MM-DD.json  (un fichier par soir, écrasé si
//          relancé le même jour).
// Rétention glissante : ne garde que les RETENTION_DAYS fichiers les plus
//          récents (par défaut 7 jours), les plus anciens sont supprimés
//          automatiquement.
//
// Restauration : voir scripts/restore-db.js

const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Config ───────────────────────────────────────────────────────────────────
const RETENTION_DAYS = 7; // 7 jours glissants (modifiable)
const BACKUP_DIR = path.join(__dirname, "../backups");

// ─── Env (.env.local) ──────────────────────────────────────────────────────────
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
  console.error("SUPABASE_PAT et NEXT_PUBLIC_SUPABASE_URL requis dans .env.local");
  process.exit(1);
}

// ─── Helper Management API ─────────────────────────────────────────────────────
function runSQL(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request(
      {
        hostname: "api.supabase.com",
        path: `/v1/projects/${REF}/database/query`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAT}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(data || "[]"); } catch { return reject(new Error("Réponse non-JSON: " + data.slice(0, 200))); }
          if (parsed && parsed.message) return reject(new Error(parsed.message));
          resolve(parsed);
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ─── Date locale YYYY-MM-DD ────────────────────────────────────────────────────
function localDate() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  const startedAt = new Date().toISOString();
  console.log(`[backup] démarrage ${startedAt} — projet ${REF}`);

  const tables = (await runSQL(
    `select table_name from information_schema.tables
     where table_schema='public' and table_type='BASE TABLE'
     order by table_name;`
  )).map((r) => r.table_name);

  const dump = { generated_at: startedAt, project_ref: REF, tables: {} };
  const counts = {};
  for (const t of tables) {
    const rows = await runSQL(`select * from public."${t}";`);
    dump.tables[t] = rows;
    counts[t] = Array.isArray(rows) ? rows.length : 0;
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const outFile = path.join(BACKUP_DIR, `canalcup-${localDate()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(dump, null, 2), "utf8");

  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);
  const sizeKB = (fs.statSync(outFile).size / 1024).toFixed(0);
  console.log(`[backup] ✅ ${tables.length} tables, ${totalRows} lignes, ${sizeKB} KB → ${path.basename(outFile)}`);

  // ─── Rétention glissante ───────────────────────────────────────────────────
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => /^canalcup-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort()        // tri lexical = tri chronologique (YYYY-MM-DD)
    .reverse();    // plus récent en premier
  const toDelete = files.slice(RETENTION_DAYS);
  for (const f of toDelete) {
    fs.unlinkSync(path.join(BACKUP_DIR, f));
    console.log(`[backup] 🗑️  purge ${f} (hors fenêtre ${RETENTION_DAYS} j)`);
  }
  console.log(`[backup] conservés : ${files.slice(0, RETENTION_DAYS).join(", ")}`);
})().catch((e) => {
  console.error("[backup] ❌", e.message);
  process.exit(1);
});
