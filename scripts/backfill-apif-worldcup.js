// backfill-apif-worldcup.js — renseigne matches.apif_id pour les 72 matchs de
// la phase de groupes de la Coupe du Monde 2026, en mappant chaque match de
// notre base (noms FR) au fixture API-Football correspondant (league=1,
// season=2026, noms EN).
//
// Sécurité : DRY-RUN par défaut. Affiche les 72 correspondances, signale tout
// match non apparié ou tout écart d'horaire (>2 min) entre base et API.
// N'écrit en base QUE si on passe --apply.
//
//   node scripts/backfill-apif-worldcup.js          → dry-run (aucune écriture)
//   node scripts/backfill-apif-worldcup.js --apply   → applique les apif_id

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}

const { createClient } = require("@supabase/supabase-js");

const KEY = process.env.API_FOOTBALL_KEY;
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!KEY || !URL || !SERVICE) { console.error("Env manquantes (.env.local)."); process.exit(1); }

const sb = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

// Nom EN (API-Football) → nom FR (notre base). 48 équipes.
const EN2FR = {
  "South Africa": "Afrique du Sud", "Algeria": "Algérie", "Germany": "Allemagne",
  "England": "Angleterre", "Saudi Arabia": "Arabie Saoudite", "Argentina": "Argentine",
  "Australia": "Australie", "Austria": "Autriche", "Belgium": "Belgique",
  "Bosnia & Herzegovina": "Bosnie-Herzégovine", "Brazil": "Brésil", "Canada": "Canada",
  "Cape Verde Islands": "Cap-Vert", "Colombia": "Colombie", "South Korea": "Corée du Sud",
  "Ivory Coast": "Côte d'Ivoire", "Croatia": "Croatie", "Curaçao": "Curaçao",
  "Scotland": "Écosse", "Egypt": "Égypte", "Ecuador": "Équateur", "Spain": "Espagne",
  "USA": "États-Unis", "France": "France", "Ghana": "Ghana", "Haiti": "Haïti",
  "Iraq": "Irak", "Iran": "Iran", "Japan": "Japon", "Jordan": "Jordanie",
  "Morocco": "Maroc", "Mexico": "Mexique", "Norway": "Norvège",
  "New Zealand": "Nouvelle-Zélande", "Uzbekistan": "Ouzbékistan", "Panama": "Panama",
  "Paraguay": "Paraguay", "Netherlands": "Pays-Bas", "Portugal": "Portugal",
  "Qatar": "Qatar", "Congo DR": "RD Congo", "Czech Republic": "République Tchèque",
  "Senegal": "Sénégal", "Sweden": "Suède", "Switzerland": "Suisse",
  "Tunisia": "Tunisie", "Türkiye": "Turquie", "Uruguay": "Uruguay",
};

async function apif(p) {
  const res = await fetch(`https://v3.football.api-sports.io${p}`, { headers: { "x-apisports-key": KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  const fx = await apif(`/fixtures?league=1&season=2026`);
  const fixtures = fx.response ?? [];
  console.log(`API-Football : ${fixtures.length} fixtures (league 1, saison 2026)\n`);

  // Matchs de groupe en base, sans apif_id.
  const { data: dbMatches } = await sb
    .from("matches")
    .select("id, team_a, team_b, starts_at, apif_id")
    .eq("phase", "Groupe")
    .gte("starts_at", "2026-06-11");

  const ok = [];
  const problems = [];

  for (const f of fixtures) {
    const enH = f.teams.home.name, enA = f.teams.away.name;
    const frH = EN2FR[enH], frA = EN2FR[enA];
    if (!frH || !frA) { problems.push(`❓ Nom non mappé : ${enH} vs ${enA} (fixture ${f.fixture.id})`); continue; }

    const m = (dbMatches ?? []).find((d) => d.team_a === frH && d.team_b === frA);
    if (!m) { problems.push(`❌ Pas de match en base pour ${frH} vs ${frA} (fixture ${f.fixture.id}, ${f.fixture.date})`); continue; }

    const dtApi = new Date(f.fixture.date).getTime();
    const dtDb = new Date(m.starts_at).getTime();
    const driftMin = Math.abs(dtApi - dtDb) / 60000;
    const flag = driftMin > 2 ? `  ⚠ écart horaire ${driftMin.toFixed(0)}min (base ${m.starts_at})` : "";
    ok.push({ id: m.id, apif: f.fixture.id, label: `${frH} vs ${frA}`, date: f.fixture.date, already: m.apif_id, flag });
  }

  console.log(`✅ Appariés : ${ok.length}/72`);
  ok.forEach((o) => console.log(`   ${o.apif}  ${o.label.padEnd(34)} ${o.date}${o.already ? " (déjà: " + o.already + ")" : ""}${o.flag}`));
  if (problems.length) { console.log(`\n⚠ Problèmes (${problems.length}) :`); problems.forEach((p) => console.log("   " + p)); }

  if (!APPLY) { console.log(`\n— DRY-RUN — relance avec --apply pour écrire les ${ok.length} apif_id.`); return; }

  let n = 0;
  for (const o of ok) {
    const { error } = await sb.from("matches").update({ apif_id: o.apif, external_id: o.apif }).eq("id", o.id);
    if (error) console.warn(`   write KO ${o.label}: ${error.message}`); else n++;
  }
  console.log(`\n✅ ${n} apif_id écrits en base.`);
})();
