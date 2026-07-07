// Restore DB — restaure des tables depuis un backup JSON (scripts/backup-db.js).
//
// Usage :
//   node scripts/restore-db.js                          # restaure TOUTES les tables du dernier backup
//   node scripts/restore-db.js --table predictions      # une seule table
//   node scripts/restore-db.js --file backups/canalcup-2026-06-16.json --table users
//   node scripts/restore-db.js --table predictions --dry-run   # n'exécute rien, affiche le plan
//
// Stratégie : upsert (INSERT ... ON CONFLICT (id) DO UPDATE) via
// jsonb_populate_recordset → Postgres recaste chaque colonne au bon type.
// Ne SUPPRIME jamais de lignes : restaure/écrase celles présentes dans le backup.
// Les lignes ajoutées APRÈS le backup ne sont pas touchées.

const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Env ────────────────────────────────────────────────────────────────────
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

// ─── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function arg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const dryRun = argv.includes("--dry-run");
const onlyTable = arg("--table");
const BACKUP_DIR = path.join(__dirname, "../backups");

let file = arg("--file");
if (!file) {
  const files = fs.existsSync(BACKUP_DIR)
    ? fs.readdirSync(BACKUP_DIR).filter((f) => /^canalcup-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort()
    : [];
  if (!files.length) { console.error("Aucun backup trouvé dans backups/. Lance d'abord node scripts/backup-db.js"); process.exit(1); }
  file = path.join(BACKUP_DIR, files[files.length - 1]); // le plus récent
}
const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
if (!fs.existsSync(filePath)) { console.error("Backup introuvable:", filePath); process.exit(1); }

const CHUNK = 500;
const TAG = "$cc_restore$"; // dollar-quoting pour le JSON

(async () => {
  const dump = JSON.parse(fs.readFileSync(filePath, "utf8"));
  console.log(`[restore] source : ${path.basename(filePath)} (généré ${dump.generated_at})`);
  if (dryRun) console.log("[restore] DRY-RUN — aucune écriture");

  // Clés primaires réelles de chaque table (gère les PK composites)
  const pkRows = await runSQL(
    `select tc.table_name, kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
     where tc.constraint_type='PRIMARY KEY' and tc.table_schema='public'
     order by tc.table_name, kcu.ordinal_position;`
  );
  const pkByTable = {};
  for (const r of pkRows) (pkByTable[r.table_name] ||= []).push(r.column_name);

  const tableNames = onlyTable ? [onlyTable] : Object.keys(dump.tables);
  for (const t of tableNames) {
    const rows = dump.tables[t];
    if (!rows) { console.warn(`[restore] ⚠️  table "${t}" absente du backup — ignorée`); continue; }
    if (!rows.length) { console.log(`[restore] ${t}: 0 ligne (rien à faire)`); continue; }

    const cols = Object.keys(rows[0]);
    const pk = pkByTable[t];
    if (!pk || !pk.length) {
      console.warn(`[restore] ⚠️  "${t}" sans clé primaire — upsert impossible, à restaurer manuellement. Ignorée.`);
      continue;
    }
    const conflictTarget = "(" + pk.map((c) => `"${c}"`).join(", ") + ")";
    const updateCols = cols.filter((c) => !pk.includes(c));
    const setClause = updateCols.length
      ? "DO UPDATE SET " + updateCols.map((c) => `"${c}"=EXCLUDED."${c}"`).join(", ")
      : "DO NOTHING";

    let restored = 0;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const json = JSON.stringify(chunk);
      if (json.includes(TAG)) throw new Error(`Conflit de dollar-quoting sur "${t}" — données contenant ${TAG}`);
      const sql =
        `INSERT INTO public."${t}" ` +
        `SELECT * FROM jsonb_populate_recordset(NULL::public."${t}", ${TAG}${json}${TAG}::jsonb) ` +
        `ON CONFLICT ${conflictTarget} ${setClause};`;
      if (dryRun) {
        console.log(`[restore] (dry) ${t}: upsert ${chunk.length} lignes`);
      } else {
        await runSQL(sql);
        restored += chunk.length;
      }
    }
    if (!dryRun) console.log(`[restore] ✅ ${t}: ${restored} lignes upsertées`);
  }
  console.log("[restore] terminé.");
})().catch((e) => {
  console.error("[restore] ❌", e.message);
  process.exit(1);
});
