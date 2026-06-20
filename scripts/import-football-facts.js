// Import d'anecdotes football dans football_facts (« Le Saviez-vous ? »).
//
// Discipline Canal Cup : 0 appel IA payant. Les faits sont générés AILLEURS
// (prompt collé dans Claude — voir docs/script/README ou la conversation) puis
// fournis en JSON. Ce script ne fait QUE valider + insérer.
//
// Gate de validation = TA revue du fichier JSON avant --apply.
//
// Format attendu (docs/script/output/football-facts.claude.json) :
//   { "facts": [
//       { "scope": "general|worldcup|team", "team": "France"|null,
//         "theme": "histoire|records|participation|joueur|equipe",
//         "content": "…", "priority": 5 }
//   ] }
//
// Usage :
//   node scripts/import-football-facts.js                 # DRY-RUN (n'écrit rien)
//   node scripts/import-football-facts.js --apply         # insère (status approved)
//   node scripts/import-football-facts.js --file chemin.json --apply
//   node scripts/import-football-facts.js --status pending --apply   # à valider plus tard

const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const envPath = path.join(ROOT, ".env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
const PAT = process.env.SUPABASE_PAT;
const REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)/)?.[1];
if (!PAT || !REF) { console.error("SUPABASE_PAT + NEXT_PUBLIC_SUPABASE_URL requis dans .env.local"); process.exit(1); }

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const fileArg = (() => { const i = argv.indexOf("--file"); return i >= 0 ? argv[i + 1] : null; })();
const statusArg = (() => { const i = argv.indexOf("--status"); return i >= 0 ? argv[i + 1] : "approved"; })();
const FILE = fileArg || path.join(ROOT, "docs/script/output/football-facts.claude.json");

function runSQL(query) {
  return new Promise((res, rej) => {
    const b = JSON.stringify({ query });
    const r = https.request(
      { hostname: "api.supabase.com", path: `/v1/projects/${REF}/database/query`, method: "POST",
        headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) } },
      (x) => { let d = ""; x.on("data", (c) => (d += c)); x.on("end", () => {
        let p; try { p = JSON.parse(d || "[]"); } catch { return rej(new Error(d.slice(0, 300))); }
        if (p && p.message) return rej(new Error(p.message)); res(p);
      }); }
    );
    r.on("error", rej); r.write(b); r.end();
  });
}

const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

(async () => {
  if (!fs.existsSync(FILE)) { console.error("Fichier introuvable :", FILE); process.exit(1); }
  const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const facts = Array.isArray(raw) ? raw : raw.facts || [];
  if (!facts.length) { console.error("Aucun fait dans le fichier."); process.exit(1); }

  // Index nom d'équipe → slug (depuis wc-teams.json).
  const teams = require(path.join(ROOT, "data/wc-teams.json"));
  const slugByName = new Map();
  for (const t of teams) slugByName.set(norm(t.name), t.slug);

  if (!["pending", "approved", "rejected"].includes(statusArg)) { console.error("--status invalide:", statusArg); process.exit(1); }

  // Déjà en base (dédoublonnage par contenu).
  const existing = new Set(
    (await runSQL("select content from public.football_facts;")).map((r) => r.content)
  );

  const rows = [];
  const seen = new Set();
  let skipped = 0;
  for (const f of facts) {
    const scope = (f.scope || "").toLowerCase();
    const content = (f.content || "").trim();
    const theme = (f.theme || "histoire").trim();
    const priority = Number.isFinite(f.priority) ? f.priority : 0;
    if (!["general", "worldcup", "team"].includes(scope) || !content) { skipped++; continue; }
    let teamSlug = null;
    if (scope === "team") {
      teamSlug = slugByName.get(norm(f.team)) || null;
      if (!teamSlug) { console.warn(`  ⚠️ équipe inconnue, ignorée : "${f.team}" — "${content.slice(0, 50)}…"`); skipped++; continue; }
    }
    if (existing.has(content) || seen.has(content)) { skipped++; continue; }
    seen.add(content);
    rows.push({ scope, teamSlug, theme, content, priority });
  }

  console.log(`[import] fichier : ${path.basename(FILE)}`);
  console.log(`[import] ${rows.length} faits à insérer (status='${statusArg}'), ${skipped} ignorés (doublons/invalides).`);
  const byScope = rows.reduce((m, r) => ((m[r.scope] = (m[r.scope] || 0) + 1), m), {});
  console.log("[import] par scope :", JSON.stringify(byScope));

  if (!apply) { console.log("[import] DRY-RUN — relance avec --apply pour écrire."); return; }
  if (!rows.length) { console.log("[import] rien à écrire."); return; }

  const esc = (s) => s.replace(/'/g, "''");
  const vals = rows.map((r) =>
    `('${r.scope}', ${r.teamSlug ? `'${esc(r.teamSlug)}'` : "NULL"}, '${esc(r.theme)}', '${esc(r.content)}', ${r.priority}, 'claude', '${statusArg}')`
  ).join(",\n");
  await runSQL(`insert into public.football_facts (scope, team_slug, theme, content, priority, source, status) values\n${vals};`);
  console.log(`[import] ✅ ${rows.length} faits insérés.`);
})().catch((e) => { console.error("[import] ❌", e.message); process.exit(1); });
