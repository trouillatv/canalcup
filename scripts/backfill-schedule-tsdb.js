// Backfill des matchs de PHASE FINALE depuis TheSportsDB (ligue 4429).
//
// Pourquoi : le plan API-Football GRATUIT n'a plus accès à la saison WC 2026
// (« Free plans do not have access to this season »). syncSeason() ne crée donc
// plus aucun match → la carte de prono n'apparaît jamais (cas vécu :
// Argentine–Suisse, quart jamais inséré, personne n'a pu parier).
//
// Ce script est le pendant one-shot de syncScheduleTsdb() (services/football/sync.ts).
// Il crée/complète les quarts, demies, petite finale et finale manquants.
//
// Dry-run par défaut ; écrit seulement avec --apply.
// Usage : node scripts/backfill-schedule-tsdb.js [--apply]

const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");

const APPLY = process.argv.includes("--apply");
const TSDB = "https://www.thesportsdb.com/api/v1/json/3";
const WC_SEASON = "2026";

// TheSportsDB : strRound souvent vide → on s'appuie sur intRound (fiable).
const ROUND_PHASE = { 125: "Quarts", 150: "Demis", 160: "3ème place", 200: "Finale" };

// Mapping minimal EN → FR + drapeaux (aligné sur lib/football/team-names.ts).
const FR = {
  Mexico: "Mexique", "South Korea": "Corée du Sud", "South Africa": "Afrique du Sud",
  "Czech Republic": "République Tchèque", Czechia: "République Tchèque", Canada: "Canada",
  Switzerland: "Suisse", Qatar: "Qatar", "Bosnia-Herzegovina": "Bosnie-Herzégovine",
  "Bosnia and Herzegovina": "Bosnie-Herzégovine", Brazil: "Brésil", Morocco: "Maroc",
  Scotland: "Écosse", Haiti: "Haïti", USA: "États-Unis", "United States": "États-Unis",
  Australia: "Australie", Paraguay: "Paraguay", Turkey: "Turquie", "Türkiye": "Turquie",
  Germany: "Allemagne", Ecuador: "Équateur", "Ivory Coast": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire", Curacao: "Curaçao", "Curaçao": "Curaçao",
  Netherlands: "Pays-Bas", Japan: "Japon", Tunisia: "Tunisie", Sweden: "Suède",
  Belgium: "Belgique", Iran: "Iran", Egypt: "Égypte", "New Zealand": "Nouvelle-Zélande",
  Spain: "Espagne", Uruguay: "Uruguay", "Saudi Arabia": "Arabie Saoudite",
  "Cape Verde": "Cap-Vert", "Cabo Verde": "Cap-Vert", France: "France", Senegal: "Sénégal",
  Norway: "Norvège", Iraq: "Irak", Argentina: "Argentine", Austria: "Autriche",
  Algeria: "Algérie", Jordan: "Jordanie", Portugal: "Portugal", Colombia: "Colombie",
  Uzbekistan: "Ouzbékistan", "DR Congo": "RD Congo", "Democratic Republic of the Congo": "RD Congo",
  England: "Angleterre", Croatia: "Croatie", Ghana: "Ghana", Panama: "Panama",
};
const FLAG = {
  Argentine: "🇦🇷", Suisse: "🇨🇭", France: "🇫🇷", Espagne: "🇪🇸", Norvège: "🇳🇴",
  Angleterre: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Maroc: "🇲🇦", Belgique: "🇧🇪",
};
const toFR = (n) => FR[n] || n;
const toFlag = (frName) => FLAG[frName] || "";

function tsdbStatus(e) {
  const s = e.strStatus || "";
  if (["Match Finished", "FT", "AOT", "AET", "AP", "Pen", "PEN"].includes(s)) return "finished";
  if (["HT", "Half Time"].includes(s)) return "halftime";
  if (["1H", "2H", "ET", "P", "In Progress"].includes(s)) return "live";
  if (["Postponed", "Cancelled", "ABD"].includes(s)) return "postponed";
  return "upcoming";
}

(async () => {
  const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const grab = async (p) => (await (await fetch(`${TSDB}${p}`)).json())?.events ?? [];
  const events = [...await grab(`/eventspastleague.php?id=4429`), ...await grab(`/eventsnextleague.php?id=4429`)]
    .filter((e) => String(e.strSeason) === WC_SEASON);

  const { data: existingRows } = await s.from("matches").select("id, team_a, team_b, external_id, is_settled");
  const matches = existingRows || [];

  console.log(`Mode: ${APPLY ? "APPLY (écriture)" : "DRY-RUN"} | événements TSDB 2026: ${events.length}\n`);

  let inserted = 0, updated = 0, skipped = 0;
  for (const e of events) {
    const phase = ROUND_PHASE[Number(e.intRound)];
    if (!phase) continue;
    const a = toFR(e.strHomeTeam), b = toFR(e.strAwayTeam);
    if (!a || !b) continue;

    const tsdbId = Number(e.idEvent);
    const status = tsdbStatus(e);
    const scoreA = e.intHomeScore != null && e.intHomeScore !== "" ? parseInt(e.intHomeScore, 10) : null;
    const scoreB = e.intAwayScore != null && e.intAwayScore !== "" ? parseInt(e.intAwayScore, 10) : null;
    const startsAt = e.strTimestamp ? `${e.strTimestamp}+00:00` : `${e.dateEvent}T${e.strTime || "00:00:00"}+00:00`;

    const pairKey = [a.toLowerCase(), b.toLowerCase()].sort().join("|");
    const found =
      matches.find((m) => m.external_id === tsdbId) ??
      matches.find((m) => [m.team_a.toLowerCase(), m.team_b.toLowerCase()].sort().join("|") === pairKey);

    if (found) {
      if (found.is_settled) { console.log(`⏭  ${phase}: ${a} vs ${b} — déjà réglé, ignoré`); skipped++; continue; }
      console.log(`✏  ${phase}: ${a} vs ${b} → ${status} ${scoreA ?? "-"}-${scoreB ?? "-"} (update)`);
      if (APPLY) {
        await s.from("matches").update({
          external_id: tsdbId, status, score_a: scoreA, score_b: scoreB,
          team_a: a, team_b: b, flag_a: toFlag(a), flag_b: toFlag(b),
          phase, venue: e.strVenue || undefined, updated_at: new Date().toISOString(),
        }).eq("id", found.id);
      }
      updated++;
    } else {
      console.log(`➕ ${phase}: ${a} vs ${b} @ ${startsAt} → ${status} ${scoreA ?? "-"}-${scoreB ?? "-"} (insert)`);
      if (APPLY) {
        const { error } = await s.from("matches").insert({
          external_id: tsdbId, competition: "FIFA World Cup 2026", phase,
          team_a: a, team_b: b, flag_a: toFlag(a), flag_b: toFlag(b),
          starts_at: startsAt, channel: "Canal+", status,
          score_a: scoreA, score_b: scoreB, venue: e.strVenue || undefined,
          // Match déjà terminé et sans prono possible → on le règle direct pour
          // éviter les effets de bord du settle (histoire IA, flashs). Un match
          // à venir reste is_settled=false (pronos ouverts).
          is_settled: status === "finished",
        });
        if (error) { console.log("   ⚠ ERREUR:", error.message); continue; }
      }
      inserted++;
    }
  }

  console.log(`\nRésumé: +${inserted} insert, ${updated} update, ${skipped} ignorés (réglés).`);
  if (!APPLY) console.log("→ Relance avec --apply pour écrire.");
})();
