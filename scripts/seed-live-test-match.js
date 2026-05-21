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

  // Préférence : compétitions MAJEURES (lineups + stats dispos sur Free).
  // ID API-Football des principales compétitions :
  //   2=UCL  3=UEL  39=Premier League  140=La Liga  61=Ligue 1
  //   78=Bundesliga  135=Serie A  4=Euro  1=WC  848=UEFA Conference
  //   71=Brésil A  88=Eredivisie  39=Premier (England)
  const MAJOR_LEAGUE_IDS = new Set([
    1, 2, 3, 4, 39, 40, 61, 71, 78, 88, 94, 135, 140, 848, 235,
  ]);

  const liveStatuses = ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"];
  const liveFixtures = fixtures.filter((x) => liveStatuses.includes(x.fixture.status.short));

  // Priorité 1 : un match d'une compétition majeure
  let f = liveFixtures.find((x) => MAJOR_LEAGUE_IDS.has(x.league?.id));
  if (f) {
    console.log(`   ✨ Compétition majeure détectée → priorité`);
  } else {
    f = liveFixtures[0] ?? fixtures[0];
    console.log(`   ⚠ Pas de compétition majeure live, fallback sur ${f.league?.name}`);
    console.log(`     (compos/stats peuvent ne pas être dispos sur API-Football Free)`);
  }

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

  const homeId = f.teams.home.id;

  // Sync events
  try {
    const ev = await apif(`/fixtures/events?fixture=${apifId}`);
    const events = (ev.response ?? []).map((e) => ({
      match_id: matchUuid,
      minute: e.time?.elapsed ?? 0,
      extra_minute: e.time?.extra ?? null,
      type: mapEventType(e.type, e.detail),
      team_side: e.team?.id === homeId ? "home" : "away",
      player_name: e.player?.name ?? "",
      assist_player_name: e.assist?.name ?? null,
      detail: e.detail ?? null,
      // source: 'api-football' — colonne non garantie selon le schéma.
      // Si tu veux la tracer, ajoute via migration et décommente.
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

  // Sync lineups (compos)
  try {
    const ln = await apif(`/fixtures/lineups?fixture=${apifId}`);
    const raw = ln.response ?? [];
    if (raw.length >= 2) {
      const players = [];
      for (let i = 0; i < 2; i++) {
        const teamData = raw[i];
        const side = teamData.team?.id === homeId ? "home" : "away";
        // startXI (titulaires)
        (teamData.startXI ?? []).forEach((p) => {
          players.push({
            match_id: matchUuid,
            team_side: side,
            player_name: p.player?.name ?? "",
            player_id: p.player?.id ? String(p.player.id) : null,
            shirt_number: p.player?.number ?? 0,
            position: p.player?.pos ?? null,
            formation_position: p.player?.grid ?? null,
            is_starting: true,
            source: "api-football",
          });
        });
        // substitutes
        (teamData.substitutes ?? []).forEach((p) => {
          players.push({
            match_id: matchUuid,
            team_side: side,
            player_name: p.player?.name ?? "",
            player_id: p.player?.id ? String(p.player.id) : null,
            shirt_number: p.player?.number ?? 0,
            position: p.player?.pos ?? null,
            is_starting: false,
            source: "api-football",
          });
        });
      }
      await sb.from("match_lineups").delete().eq("match_id", matchUuid);
      if (players.length > 0) {
        const { error } = await sb.from("match_lineups").insert(players);
        if (error) console.warn("⚠ insert lineups :", error.message);
        else console.log(`✅ ${players.length} joueurs (compos) insérés.`);
      }
    } else {
      console.log("   Compos non disponibles pour ce match (compétition mineure ?).");
    }
  } catch (e) {
    console.warn("⚠ lineups KO :", e.message);
  }

  // Sync stats (possession, tirs, corners, etc.)
  try {
    const st = await apif(`/fixtures/statistics?fixture=${apifId}`);
    const raw = st.response ?? [];
    if (raw.length >= 2) {
      const homeTeamData = raw.find((r) => r.team?.id === homeId) ?? raw[0];
      const awayTeamData = raw.find((r) => r.team?.id !== homeId) ?? raw[1];
      const homeMap = new Map((homeTeamData.statistics ?? []).map((s) => [s.type, s.value]));
      const awayMap = new Map((awayTeamData.statistics ?? []).map((s) => [s.type, s.value]));
      const allKeys = new Set([...homeMap.keys(), ...awayMap.keys()]);
      const stats = [];
      for (const k of allKeys) {
        stats.push({
          match_id: matchUuid,
          stat_type: k,
          home_value: String(homeMap.get(k) ?? "0"),
          away_value: String(awayMap.get(k) ?? "0"),
          source: "api-football",
          updated_at: new Date().toISOString(),
        });
      }
      await sb.from("match_stats").delete().eq("match_id", matchUuid);
      if (stats.length > 0) {
        const { error } = await sb.from("match_stats").insert(stats);
        if (error) console.warn("⚠ insert stats :", error.message);
        else console.log(`✅ ${stats.length} stats (possession, tirs, …) insérées.`);
      }
    } else {
      console.log("   Stats non disponibles pour ce match.");
    }
  } catch (e) {
    console.warn("⚠ stats KO :", e.message);
  }

  console.log("");
  console.log("👉 OUVRE :");
  console.log(`   ${APP_URL}/matches/${matchUuid}`);
  console.log("");
  console.log("Relance ce script (ou attends le cron) pour voir score/events évoluer.");
})();
