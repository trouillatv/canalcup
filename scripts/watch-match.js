// watch-match.js — boucle de refresh d'un match LIVE avec budget intelligent.
//
// Usage :
//   node scripts/watch-match.js <match-uuid> [--matches=1] [--budget=90]
//
// Stratégie quota (API-Football Free = 100 req/jour, on garde 10 de marge) :
//
//   budget_per_day      = 90 calls (paramétrable via --budget)
//   matches_per_day     = N (paramétrable via --matches)
//   calls_per_match     = budget / N
//   match_duration_min  = 100 (90 + injuries + extra time)
//   interval_seconds    = ceil((match_duration_min × 60) / calls_per_match)
//
// Exemples :
//   1 match/jour    → 90 calls → 1 toutes 67s   (interval ≈ 70s)
//   4 matchs/jour   → 22 calls → 1 toutes 273s  (interval ≈ 280s = 4min40)
//   6 matchs/jour   → 15 calls → 1 toutes 400s  (interval ≈ 7min)
//
// Compos = 1 sync UNIQUE au début (statique). Pas comptée dans le budget loop.
// Events = re-syncés à chaque tick (mêmes calls que score → ne double pas).
//
// Le script s'arrête automatiquement si le match passe à FINISHED.

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

const args = process.argv.slice(2);
const matchUuid = args.find((a) => !a.startsWith("--"));
const arg = (name, def) => {
  const v = args.find((a) => a.startsWith(`--${name}=`));
  return v ? Number(v.split("=")[1]) : def;
};
const MATCHES_PER_DAY = Math.max(1, arg("matches", 1));
const BUDGET_PER_DAY = Math.max(10, arg("budget", 90));
const MATCH_MINUTES = 100; // 90 + injuries

const callsPerMatch = Math.floor(BUDGET_PER_DAY / MATCHES_PER_DAY);
const intervalSec = Math.max(30, Math.ceil((MATCH_MINUTES * 60) / callsPerMatch));

if (!matchUuid) {
  console.error("Usage : node scripts/watch-match.js <match-uuid> [--matches=1] [--budget=90]");
  process.exit(1);
}
if (!KEY || !URL || !SERVICE) {
  console.error("Env manquantes.");
  process.exit(1);
}

const sb = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let callCount = 0;

async function apif(p) {
  callCount += 1;
  const res = await fetch(`https://v3.football.api-sports.io${p}`, {
    headers: { "x-apisports-key": KEY },
  });
  if (res.status === 429 || res.status === 403) {
    throw new Error(`quota_exceeded (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function mapEventType(t, d) {
  const T = (t || "").toLowerCase();
  const D = (d || "").toLowerCase();
  if (T === "goal") return "goal";
  if (T === "card") return D.includes("red") ? "red_card" : "yellow_card";
  if (T === "subst") return "substitution";
  if (T === "var") return "var";
  return "goal";
}

async function syncLineupsOnce(matchUuid, apifId, homeTeamApifId) {
  const ln = await apif(`/fixtures/lineups?fixture=${apifId}`);
  const raw = ln.response ?? [];
  if (raw.length < 2) {
    console.log("  Compos non dispo (compétition mineure ?).");
    return 0;
  }
  const players = [];
  for (const teamData of raw) {
    const side = teamData.team?.id === homeTeamApifId ? "home" : "away";
    (teamData.startXI ?? []).forEach((p) => players.push({
      match_id: matchUuid, team_side: side,
      player_name: p.player?.name ?? "",
      player_id: p.player?.id ? String(p.player.id) : null,
      shirt_number: p.player?.number ?? 0,
      position: p.player?.pos ?? null,
      formation_position: p.player?.grid ?? null,
      is_starting: true,
    }));
    (teamData.substitutes ?? []).forEach((p) => players.push({
      match_id: matchUuid, team_side: side,
      player_name: p.player?.name ?? "",
      player_id: p.player?.id ? String(p.player.id) : null,
      shirt_number: p.player?.number ?? 0,
      position: p.player?.pos ?? null,
      is_starting: false,
    }));
  }
  await sb.from("match_lineups").delete().eq("match_id", matchUuid);
  if (players.length > 0) await sb.from("match_lineups").insert(players);
  return players.length;
}

async function tickApif(apifId, homeTeamApifId, matchUuid) {
  // 2 calls : fixture (score+minute) + events.
  const fx = await apif(`/fixtures?id=${apifId}`);
  const f = fx.response?.[0];
  if (!f) return null;

  const ev = await apif(`/fixtures/events?fixture=${apifId}`);
  const apifEvents = ev.response ?? [];

  const isLive = ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(f.fixture.status.short);
  const isFinished = ["FT", "AET", "PEN"].includes(f.fixture.status.short);

  await sb
    .from("matches")
    .update({
      score_a: f.goals.home, score_b: f.goals.away,
      minute: f.fixture.status.elapsed,
      status: isFinished ? "finished" : isLive ? "live" : "upcoming",
      updated_at: new Date().toISOString(),
    })
    .eq("id", matchUuid);

  const events = apifEvents.map((e) => ({
    match_id: matchUuid,
    minute: e.time?.elapsed ?? 0,
    extra_minute: e.time?.extra ?? null,
    type: mapEventType(e.type, e.detail),
    team_side: e.team?.id === homeTeamApifId ? "home" : "away",
    player_name: e.player?.name ?? "",
    assist_player_name: e.assist?.name ?? null,
    detail: e.detail ?? null,
  }));
  await sb.from("match_events").delete().eq("match_id", matchUuid);
  if (events.length > 0) await sb.from("match_events").insert(events);

  return {
    score_a: f.goals.home, score_b: f.goals.away,
    minute: f.fixture.status.elapsed,
    status: isFinished ? "finished" : isLive ? "live" : "upcoming",
    statusShort: f.fixture.status.short,
    eventsCount: events.length,
  };
}

(async () => {
  const { data: match } = await sb
    .from("matches")
    .select("id, team_a, team_b, apif_id, external_id, status")
    .eq("id", matchUuid)
    .maybeSingle();
  if (!match) { console.error(`Match ${matchUuid} introuvable.`); process.exit(1); }
  const apifId = match.apif_id || match.external_id;
  if (!apifId) {
    console.error("Match sans apif_id ni external_id. Relance seed-live-test-match.js.");
    process.exit(1);
  }

  // ────────── budget summary ──────────
  console.log("═══════════════════════════════════════════════");
  console.log(`Watch: ${match.team_a} vs ${match.team_b}`);
  console.log(`Budget: ${BUDGET_PER_DAY} calls/jour ÷ ${MATCHES_PER_DAY} match(s)/jour = ${callsPerMatch} calls/match`);
  console.log(`Match: ${MATCH_MINUTES} min → interval ≈ ${intervalSec}s (${Math.floor(intervalSec/60)}min ${intervalSec%60}s)`);
  console.log(`Chaque tick = 2 calls (fixture + events) → conso doublée`);
  console.log("⚠ pour rester strictement dans le budget, double l'interval :");
  console.log(`  recommandé : --matches=${MATCHES_PER_DAY*2} (=interval ${intervalSec*2}s)`);
  console.log("═══════════════════════════════════════════════");
  console.log("");

  // Init : récup team home ID + sync compos UNE FOIS
  const first = await apif(`/fixtures?id=${apifId}`);
  const homeTeamApifId = first.response?.[0]?.teams?.home?.id;
  if (!homeTeamApifId) {
    console.error("Impossible de récupérer l'id de l'équipe home.");
    process.exit(1);
  }
  const lineupCount = await syncLineupsOnce(matchUuid, apifId, homeTeamApifId);
  console.log(`✅ Compos synced (1 sync, ${lineupCount} joueurs). Calls=${callCount}`);
  console.log("");

  let prevEventsCount = 0;
  let consecutiveErrors = 0;
  const startedAt = Date.now();

  while (true) {
    try {
      const snap = await tickApif(apifId, homeTeamApifId, matchUuid);
      consecutiveErrors = 0;
      if (snap) {
        const newEvents = snap.eventsCount - prevEventsCount;
        const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);
        const remaining = Math.max(0, BUDGET_PER_DAY - callCount);
        console.log(
          `${snap.statusShort} ${snap.minute ?? "?"}' — ` +
            `${snap.score_a}–${snap.score_b} — ` +
            `${snap.eventsCount} events${newEvents > 0 ? ` (🆕+${newEvents})` : ""} — ` +
            `calls=${callCount} (reste ${remaining}) — watch=${elapsedMin}min`
        );
        prevEventsCount = snap.eventsCount;
        if (snap.status === "finished") {
          console.log("\n🏁 Match terminé. Watch stoppé.");
          break;
        }
      }
    } catch (e) {
      consecutiveErrors += 1;
      console.warn(`⚠ ${e.message} (errors=${consecutiveErrors})`);
      if (e.message.includes("quota_exceeded")) {
        console.warn("→ Quota API-Football dépassé. Stop.");
        break;
      }
      if (consecutiveErrors >= 5) { console.warn("Stop (trop d'erreurs)."); break; }
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }

  console.log(`\nTotal calls : ${callCount} / ${BUDGET_PER_DAY} budgétés`);
})();
