// backfill-apif-worldcup.js — renseigne matches.apif_id pour tous les matchs de
// la Coupe du Monde 2026, en mappant chaque match de
// notre base (noms FR) au fixture API-Football correspondant (league=1,
// season=2026, noms EN).
//
// Sécurité : DRY-RUN par défaut. Affiche les correspondances, signale tout
// match non appariÃ© ou tout Ã©cart d'horaire (>2 min) entre base et API.
// N'Ã©crit en base QUE si on passe --apply.
//
//   node scripts/backfill-apif-worldcup.js          â†’ dry-run (aucune Ã©criture)
//   node scripts/backfill-apif-worldcup.js --apply   â†’ applique les apif_id

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

// Nom EN (API-Football) â†’ nom FR (notre base). 48 Ã©quipes.
const EN2FR = {
  "South Africa": "Afrique du Sud", "Algeria": "AlgÃ©rie", "Germany": "Allemagne",
  "England": "Angleterre", "Saudi Arabia": "Arabie Saoudite", "Argentina": "Argentine",
  "Australia": "Australie", "Austria": "Autriche", "Belgium": "Belgique",
  "Bosnia & Herzegovina": "Bosnie-HerzÃ©govine", "Brazil": "BrÃ©sil", "Canada": "Canada",
  "Cape Verde Islands": "Cap-Vert", "Colombia": "Colombie", "South Korea": "CorÃ©e du Sud",
  "Ivory Coast": "CÃ´te d'Ivoire", "Croatia": "Croatie", "CuraÃ§ao": "CuraÃ§ao",
  "Scotland": "Ã‰cosse", "Egypt": "Ã‰gypte", "Ecuador": "Ã‰quateur", "Spain": "Espagne",
  "USA": "Ã‰tats-Unis", "France": "France", "Ghana": "Ghana", "Haiti": "HaÃ¯ti",
  "Iraq": "Irak", "Iran": "Iran", "Japan": "Japon", "Jordan": "Jordanie",
  "Morocco": "Maroc", "Mexico": "Mexique", "Norway": "NorvÃ¨ge",
  "New Zealand": "Nouvelle-ZÃ©lande", "Uzbekistan": "OuzbÃ©kistan", "Panama": "Panama",
  "Paraguay": "Paraguay", "Netherlands": "Pays-Bas", "Portugal": "Portugal",
  "Qatar": "Qatar", "Congo DR": "RD Congo", "Czech Republic": "RÃ©publique TchÃ¨que",
  "Senegal": "SÃ©nÃ©gal", "Sweden": "SuÃ¨de", "Switzerland": "Suisse",
  "Tunisia": "Tunisie", "TÃ¼rkiye": "Turquie", "Uruguay": "Uruguay",
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

  // Tous les matchs WC2026 en base, sans apif_id.
  const { data: dbMatches } = await sb
    .from("matches")
    .select("id, team_a, team_b, starts_at, apif_id, phase")
    .eq("competition", "Coupe du Monde 2026");

  const ok = [];
  const problems = [];

  for (const f of fixtures) {
    const enH = f.teams.home.name, enA = f.teams.away.name;
    const frH = EN2FR[enH], frA = EN2FR[enA];
    if (!frH || !frA) { problems.push(`â“ Nom non mappÃ© : ${enH} vs ${enA} (fixture ${f.fixture.id})`); continue; }

    const m = (dbMatches ?? []).find(
      (d) =>
        (d.team_a === frH && d.team_b === frA) ||
        (d.team_a === frA && d.team_b === frH)
    );
    if (!m) { problems.push(`âŒ Pas de match en base pour ${frH} vs ${frA} (fixture ${f.fixture.id}, ${f.fixture.date})`); continue; }

    const dtApi = new Date(f.fixture.date).getTime();
    const dtDb = new Date(m.starts_at).getTime();
    const driftMin = Math.abs(dtApi - dtDb) / 60000;
    const flag = driftMin > 2 ? `  âš  Ã©cart horaire ${driftMin.toFixed(0)}min (base ${m.starts_at})` : "";
    ok.push({ id: m.id, apif: f.fixture.id, label: `${frH} vs ${frA}`, date: f.fixture.date, already: m.apif_id, flag });
  }

  console.log(`✅ Appariés : ${ok.length}`);
  ok.forEach((o) => console.log(`   ${o.apif}  ${o.label.padEnd(34)} ${o.date}${o.already ? " (dÃ©jÃ : " + o.already + ")" : ""}${o.flag}`));
  if (problems.length) { console.log(`\nâš  ProblÃ¨mes (${problems.length}) :`); problems.forEach((p) => console.log("   " + p)); }

  if (!APPLY) { console.log(`\n— DRY-RUN — relance avec --apply pour écrire les ${ok.length} apif_id.`); return; }

  let n = 0;
  for (const o of ok) {
    const { error } = await sb.from("matches").update({ apif_id: o.apif, external_id: o.apif }).eq("id", o.id);
    if (error) console.warn(`   write KO ${o.label}: ${error.message}`); else n++;
  }
  console.log(`\nâœ… ${n} apif_id Ã©crits en base.`);
})();

