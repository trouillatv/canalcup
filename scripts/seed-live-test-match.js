// Test API-Football "en conditions réelles" :
//   1. Appelle /fixtures?live=all pour récupérer les matchs LIVE.
//   2. Choisit le 1er match en cours (n'importe quelle compétition).
//   3. UPSERT dans public.matches (idempotent via external_id = apif_id).
//   4. Sync events (buts, cartons, subs) dans match_events.
//
// Usage :
//   node scripts/seed-live-test-match.js
//
// L'URL à visiter sur l'app : ${APP_URL}/matches/<uuid>

const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

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
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://canal-cup.vercel.app").replace(/\/$/, "");

if (!KEY) { console.error("Manque API_FOOTBALL_KEY"); process.exit(1); }
if (!URL || !SERVICE) { console.error("Manque Supabase env"); process.exit(1); }

const sb = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function apif(p) {
  const res = await fetch(`https://v3.football.api-sports.io${p}`, {
    headers: { "x-apisports-key": KEY },
  });
  if (!res.ok) throw new Error(`API-Football HTTP ${res.status}`);
  return res.json();
}

// Map API-Football event type → notre enum match_events.type
function mapEventType(apifType, apifDetail) {
  const t = (apifType || "").toLowerCase();
  const d = (apifDetail || "").toLowerCase();
  if (t === "goal") {
    if (d.includes("penalty") && d.includes("missed")) return "penalty_missed";
    if (d.includes("own")) return "goal";
    return "goal";
  }
  if (t === "card") {
    if (d.includes("red")) return "red_card";
    return "yellow_card";
  }
  if (t === "subst") return "substitution";
  if (t === "var") return "var";
  return "goal"; // fallback safe
}

(async () => {
  console.log("→ Recherche d'un match LIVE actuellement…");
  const live = await apif("/fixtures?live=all");
  const fixtures = live.response ?? [];
  if (fixtures.length === 0) {
    console.error("❌ Aucun match en direct en ce moment. Réessaie dans qq min.");
    process.exit(1);
  }
  console.log(`   ${fixtures.length} match(s) en direct trouvé(s).`);

  // Prend le premier match LIVE (statuts à inclure)
  const f = fixtures.find((x) =>
    ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(x.fixture.status.short)
  ) ?? fixtures[0];

  const apifId = f.fixture.id;
  const startsAt = new Date(f.fixture.date).toISOString();
  const teamA = f.teams.home.name;
  const teamB = f.teams.away.name;
  const flagA = f.teams.home.logo || null;
  const flagB = f.teams.away.logo || null;
  const scoreA = f.goals.home;
  const scoreB = f.goals.away;
  const minute = f.fixture.status.elapsed;
  const statusShort = f.fixture.status.short;

  console.log(
    `   Choisi : ${teamA} vs ${teamB} — ${statusShort} ${minute}' — ${scoreA}–${scoreB} ` +
      `(${f.league.name})`
  );

  // Vérifie si match déjà inséré (recherche par external_id = apif_id).
  const { data: existing } = await sb
    .from("matches")
    .select("id")
    .eq("external_id", apifId)
    .maybeSingle();

  let matchUuid;
  if (existing) {
    matchUuid = existing.id;
    await sb
      .from("matches")
      .update({
        starts_at: startsAt,
        team_a: teamA, team_b: teamB,
        flag_a: flagA, flag_b: flagB,
        score_a: scoreA, score_b: scoreB,
        status: "live",
        minute: minute ?? null,
        phase: "Test live",
        venue: f.fixture.venue?.name ?? null,
        referee: f.fixture.referee ?? null,
        apif_id: apifId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchUuid);
    console.log(`✅ Match déjà existant — mis à jour (id=${matchUuid}).`);
  } else {
    matchUuid = randomUUID();
    const { error } = await sb.from("matches").insert({
      id: matchUuid,
      competition: f.league.name ?? "Test live",
      team_a: teamA, team_b: teamB,
      flag_a: flagA, flag_b: flagB,
      starts_at: startsAt,
      score_a: scoreA, score_b: scoreB,
      status: "live",
      minute: minute ?? null,
      phase: "Test live",
      venue: f.fixture.venue?.name ?? null,
      referee: f.fixture.referee ?? null,
      external_id: apifId,
      apif_id: apifId,
    });
    if (error) { console.error("INSERT KO :", error.message); process.exit(1); }
    console.log(`✅ Match inséré (id=${matchUuid}).`);
  }

  // Sync events
  try {
    const ev = await apif(`/fixtures/events?fixture=${apifId}`);
    const homeId = f.teams.home.id;
    const events = (ev.response ?? []).map((e) => ({
      match_id: matchUuid,
      minute: e.time?.elapsed ?? 0,
      extra_minute: e.time?.extra ?? null,
      type: mapEventType(e.type, e.detail),
      team_side: e.team?.id === homeId ? "home" : "away",
      player_name: e.player?.name ?? "",
      assist_player_name: e.assist?.name ?? null,
      detail: e.detail ?? null,
      source: "api-football",
    }));
    await sb.from("match_events").delete().eq("match_id", matchUuid);
    if (events.length > 0) {
      const { error } = await sb.from("match_events").insert(events);
      if (error) console.warn("⚠ insert events :", error.message);
      else console.log(`✅ ${events.length} events insérés.`);
    } else {
      console.log("   Aucun event encore (début de match ?).");
    }
  } catch (e) {
    console.warn("⚠ events KO :", e.message);
  }

  console.log("");
  console.log("👉 OUVRE :");
  console.log(`   ${APP_URL}/matches/${matchUuid}`);
  console.log("");
  console.log("Relance ce script (ou attends le cron) pour voir score/events évoluer.");
})();
