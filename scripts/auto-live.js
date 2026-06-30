// auto-live.js — pilote LOCAL du sync live (cadence fine, ~90 s).
//
// Ping en boucle l'endpoint /api/cron/live-matches. L'endpoint ne touche
// API-Football QUE si un match est dans sa fenêtre live → laisser tourner ne
// gaspille pas de quota hors match. Utile pour un gros match (ex. France) où
// on veut des scores plus frais que le ping GitHub Actions (5 min).
//
//   node scripts/auto-live.js                      → prod, toutes les 120 s
//   node scripts/auto-live.js --interval=90        → cadence en secondes (min 60)
//   node scripts/auto-live.js --url=http://localhost:3001
//        → cible un dev server local (auth désactivée hors production)
//
// Pour cibler la PROD, il faut CRON_SECRET dans .env.local (même valeur que la
// var d'env Vercel). Pour cibler localhost, le secret n'est pas requis.

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const args = process.argv.slice(2);
const arg = (n, d) => {
  const v = args.find((a) => a.startsWith(`--${n}=`));
  return v ? v.split("=")[1] : d;
};
const BASE = (arg("url", "https://canal-cup.vercel.app")).replace(/\/$/, "");
const INTERVAL = Math.max(60, Number(arg("interval", "120"))) * 1000;
const SECRET = process.env.CRON_SECRET;
const isProd = !BASE.includes("localhost") && !BASE.includes("127.0.0.1");

if (isProd && !SECRET) {
  console.error("Manque CRON_SECRET dans .env.local (requis pour cibler la prod).");
  console.error("→ copie la valeur depuis Vercel, ou cible le local : --url=http://localhost:3001");
  process.exit(1);
}

const url = `${BASE}/api/cron/live-matches`;
const hms = () => new Date().toISOString().slice(11, 19);
console.log(`▶ auto-live : ping ${url} toutes les ${INTERVAL / 1000}s. Ctrl+C pour arrêter.`);

async function tick() {
  try {
    const r = await fetch(url, SECRET ? { headers: { authorization: `Bearer ${SECRET}` } } : {});
    const j = await r.json().catch(() => ({}));
    if (r.status !== 200) console.warn(`${hms()} — HTTP ${r.status} ${JSON.stringify(j)}`);
    else if (j.skipped) console.log(`${hms()} — aucun match en fenêtre live (0 appel API)`);
    else console.log(`${hms()} — live_synced=${j.live_synced ?? "?"} settled=${j.settled_total ?? 0}`);
  } catch (e) {
    console.warn(`${hms()} — KO: ${e.message}`);
  }
}

(async () => {
  await tick();
  setInterval(tick, INTERVAL);
})();
