// Sync LIVE RÉEL du match Rayo Vallecano - Crystal Palace (vrai match de demain).
// Toutes les 30 s : lit API-Football /fixtures?live=all, trouve Rayo-Palace,
// met à jour NOTRE match de pronos (score + cartons/buts + compos + stats),
// puis règle les pronos quand le match est terminé.
//
// On garde le match SANS external_id : c'est CE script qui pousse les données
// (le refresh on-read de l'app ne l'écrase donc pas). live=all marche sur le
// plan gratuit (vu : 3 matchs live ramenés).
//
// Modes :
//   node scripts/simulate-rayo-palace.js auto    → boucle toutes les 30 s (défaut)
//   node scripts/simulate-rayo-palace.js once     → un seul passage
//   node scripts/simulate-rayo-palace.js reset     → remet en 'upcoming'

const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("="); if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");
const KEY = process.env.API_FOOTBALL_KEY;
// Fixture API-Football confirmée : Crystal Palace vs Rayo Vallecano,
// Conference League, 27/05/2026 19:00 UTC.
const FIXTURE_ID = 1544608;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const POLL_MS = 30_000;

async function apif(p) {
  const r = await fetch(`https://v3.football.api-sports.io${p}`, { headers: { "x-apisports-key": KEY } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) { console.warn("[apif]", JSON.stringify(j.errors)); }
  return j;
}
function mapEventType(t, d) {
  t = (t || "").toLowerCase(); d = (d || "").toLowerCase();
  if (t === "goal") return d.includes("missed") ? "penalty_missed" : "goal";
  if (t === "card") return d.includes("red") ? "red_card" : "yellow_card";
  if (t === "subst") return "substitution";
  if (t === "var") return "var";
  return "goal";
}
function isRayo(n) { return /rayo|vallecano/i.test(n || ""); }
function isPalace(n) { return /crystal|palace/i.test(n || ""); }

async function getMatchId() {
  const { data } = await sb.from("matches").select("id").eq("team_a", "Rayo Vallecano").eq("team_b", "Crystal Palace").maybeSingle();
  if (!data) { console.error("Match Rayo-Palace introuvable en base."); process.exit(1); }
  return data.id;
}

// Barème Groupe ×1 : exact 10, bon résultat 5, sinon 0.
function points(pa, pb, aa, ab) {
  if (pa == null || pb == null) return 0;
  if (pa === aa && pb === ab) return 10;
  const sg = (x, y) => (x > y ? 1 : x < y ? -1 : 0);
  return sg(pa, pb) === sg(aa, ab) ? 5 : 0;
}
async function settle(matchId, a, b) {
  const { data: preds } = await sb.from("predictions").select("id, predicted_score_a, predicted_score_b").eq("match_id", matchId);
  let exact = 0, good = 0;
  for (const p of preds ?? []) {
    const pts = points(p.predicted_score_a, p.predicted_score_b, a, b);
    await sb.from("predictions").update({ points_awarded: pts }).eq("id", p.id);
    if (pts === 10) exact++; else if (pts === 5) good++;
  }
  console.log(`🏁 ${a}-${b} | pronos réglés : ${preds?.length ?? 0} (🎯 ${exact} exacts, ✅ ${good} bons).`);
}

const FINISHED = ["FT", "AET", "PEN"];

// Un passage : lit la fixture par son id et met à jour notre match.
async function tick(matchId) {
  const j = await apif(`/fixtures?id=${FIXTURE_ID}`);
  const fx = (j.response || [])[0] || null;
  if (!fx) { console.log(new Date().toLocaleTimeString(), "— fixture introuvable (API)."); return false; }

  const apifId = fx.fixture.id;
  const homeIsRayo = isRayo(fx.teams.home.name);
  const rayoApiId = homeIsRayo ? fx.teams.home.id : fx.teams.away.id;
  const scoreRayo = homeIsRayo ? fx.goals.home : fx.goals.away;     // = notre team_a
  const scorePalace = homeIsRayo ? fx.goals.away : fx.goals.home;   // = notre team_b
  const status = fx.fixture.status.short;
  const minute = fx.fixture.status.elapsed;
  const NOT_STARTED = ["TBD", "NS", "PST", "CANC", "SUSP", "INT"];
  const appStatus = FINISHED.includes(status) ? "finished" : NOT_STARTED.includes(status) ? "upcoming" : "live";

  const upcoming = appStatus === "upcoming";
  await sb.from("matches").update({
    status: appStatus,
    score_a: upcoming ? null : (scoreRayo ?? 0), score_b: upcoming ? null : (scorePalace ?? 0),
    minute: upcoming ? null : (minute ?? null),
    venue: fx.fixture.venue?.name ?? null, referee: fx.fixture.referee ?? null,
  }).eq("id", matchId);

  // Events (buts, cartons, subs)
  try {
    const ev = await apif(`/fixtures/events?fixture=${apifId}`);
    const rows = (ev.response || []).map((e) => ({
      match_id: matchId, minute: e.time?.elapsed ?? 0, extra_minute: e.time?.extra ?? null,
      type: mapEventType(e.type, e.detail), team_side: e.team?.id === rayoApiId ? "home" : "away",
      player_name: e.player?.name ?? "", assist_player_name: e.assist?.name ?? null, detail: e.detail ?? null,
    }));
    await sb.from("match_events").delete().eq("match_id", matchId);
    if (rows.length) await sb.from("match_events").insert(rows);
    var nEv = rows.length;
  } catch { var nEv = 0; }

  // Compos (si dispo sur le plan / la compèt)
  let nLineup = 0;
  try {
    const ln = await apif(`/fixtures/lineups?fixture=${apifId}`);
    const raw = ln.response || [];
    if (raw.length >= 2) {
      const players = [];
      for (const td of raw) {
        const side = td.team?.id === rayoApiId ? "home" : "away";
        (td.startXI || []).forEach((p) => players.push({ match_id: matchId, team_side: side, player_name: p.player?.name ?? "", player_id: p.player?.id ? String(p.player.id) : null, shirt_number: p.player?.number ?? 0, position: p.player?.pos ?? null, formation_position: p.player?.grid ?? null, is_starting: true, source: "api-football" }));
        (td.substitutes || []).forEach((p) => players.push({ match_id: matchId, team_side: side, player_name: p.player?.name ?? "", player_id: p.player?.id ? String(p.player.id) : null, shirt_number: p.player?.number ?? 0, position: p.player?.pos ?? null, is_starting: false, source: "api-football" }));
      }
      await sb.from("match_lineups").delete().eq("match_id", matchId);
      if (players.length) await sb.from("match_lineups").insert(players);
      nLineup = players.length;
    }
  } catch { /* compos KO */ }

  console.log(new Date().toLocaleTimeString(), `— ${fx.teams.home.name} ${fx.goals.home}-${fx.goals.away} ${fx.teams.away.name} [${status} ${minute || ""}'] | events ${nEv} | compos ${nLineup}`);

  if (FINISHED.includes(status)) {
    await settle(matchId, scoreRayo ?? 0, scorePalace ?? 0);
    return true; // terminé
  }
  return false;
}

(async () => {
  if (!KEY) { console.error("Manque API_FOOTBALL_KEY"); process.exit(1); }
  const mode = process.argv[2] || "auto";
  const matchId = await getMatchId();

  if (mode === "reset") {
    await sb.from("match_events").delete().eq("match_id", matchId);
    await sb.from("match_lineups").delete().eq("match_id", matchId);
    await sb.from("match_stats").delete().eq("match_id", matchId);
    await sb.from("matches").update({ status: "upcoming", score_a: null, score_b: null, minute: null }).eq("id", matchId);
    console.log("✅ Remis en 'upcoming'."); return;
  }
  if (mode === "once") { await tick(matchId); return; }

  // auto : boucle toutes les 30 s jusqu'au coup de sifflet final.
  console.log(`▶ Sync live Rayo-Palace toutes les ${POLL_MS / 1000}s. Ctrl+C pour arrêter.`);
  const loop = async () => {
    try { if (await tick(matchId)) { console.log("✅ Match terminé, arrêt du sync."); process.exit(0); } }
    catch (e) { console.warn("tick KO:", e.message); }
    setTimeout(loop, POLL_MS);
  };
  loop();
})();
