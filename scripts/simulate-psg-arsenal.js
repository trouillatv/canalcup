// Sync LIVE de la finale Ligue des Champions PSG - Arsenal (sam 30/05 18h Paris).
// Calque sur simulate-rayo-palace.js mais ECONOMIQUE EN QUOTA :
//
//   • Toutes les 120 s pendant le live → 1 appel /fixtures?live=all.
//   • Events (buts/cartons/subs) RE-TIRES UNIQUEMENT si le score a change.
//   • Compos tirees UNE SEULE FOIS quand elles apparaissent.
//   • Pas de poll avant le coup d'envoi (filtre par team names dans live=all).
//   • Arret automatique au coup de sifflet final (status FT/AET/PEN).
//
// Quota estime sur 2h10 de live : ~65 appels live=all + ~5 events + 1 lineups
// = ~71 appels / 100 du plan gratuit. Confortable sous le cap interne (90).
//
// On NE STOCKE PAS apif_id sur la ligne du match : le resync on-read de l'app
// l'ignorera donc, et seul ce script pousse les donnees (pas de course).
//
// Modes :
//   node scripts/simulate-psg-arsenal.js auto    → boucle 120 s (defaut)
//   node scripts/simulate-psg-arsenal.js once    → un seul passage
//   node scripts/simulate-psg-arsenal.js reset   → remet en 'upcoming'

const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");

const KEY = process.env.API_FOOTBALL_KEY;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const POLL_MS = 120_000;
const FINISHED = ["FT", "AET", "PEN"];
const NOT_STARTED = ["TBD", "NS", "PST", "CANC", "SUSP", "INT"];

async function apif(p) {
  const r = await fetch(`https://v3.football.api-sports.io${p}`, { headers: { "x-apisports-key": KEY } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  if (j.errors && Object.keys(j.errors).length) console.warn("[apif]", JSON.stringify(j.errors));
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

const isPsg = (n) => /\b(psg|paris)\b/i.test(n || "");
const isArsenal = (n) => /arsenal/i.test(n || "");

async function getMatchId() {
  const { data } = await sb.from("matches").select("id").eq("team_a", "PSG").eq("team_b", "Arsenal").maybeSingle();
  if (!data) { console.error("Match PSG-Arsenal introuvable en base."); process.exit(1); }
  return data.id;
}

// Trouve la fixture PSG-Arsenal dans la liste des matchs live (1 appel).
async function findLiveFixture() {
  const j = await apif("/fixtures?live=all");
  for (const fx of j.response || []) {
    const h = fx.teams?.home?.name ?? "";
    const a = fx.teams?.away?.name ?? "";
    if ((isPsg(h) && isArsenal(a)) || (isPsg(a) && isArsenal(h))) return fx;
  }
  return null;
}

// Compos tirees UNE SEULE FOIS (drapeau en memoire, pas en base).
let lineupsDone = false;
async function syncLineups(matchId, apifId, psgApiId) {
  if (lineupsDone) return 0;
  try {
    const ln = await apif(`/fixtures/lineups?fixture=${apifId}`);
    const raw = ln.response || [];
    if (raw.length < 2) return 0;
    const players = [];
    for (const td of raw) {
      const side = td.team?.id === psgApiId ? "home" : "away";
      (td.startXI || []).forEach((p) => players.push({
        match_id: matchId, team_side: side, player_name: p.player?.name ?? "",
        player_id: p.player?.id ? String(p.player.id) : null,
        shirt_number: p.player?.number ?? 0, position: p.player?.pos ?? null,
        formation_position: p.player?.grid ?? null, is_starting: true, source: "api-football",
      }));
      (td.substitutes || []).forEach((p) => players.push({
        match_id: matchId, team_side: side, player_name: p.player?.name ?? "",
        player_id: p.player?.id ? String(p.player.id) : null,
        shirt_number: p.player?.number ?? 0, position: p.player?.pos ?? null,
        is_starting: false, source: "api-football",
      }));
    }
    await sb.from("match_lineups").delete().eq("match_id", matchId);
    if (players.length) await sb.from("match_lineups").insert(players);
    lineupsDone = true;
    return players.length;
  } catch { return 0; }
}

// Events resynces seulement si le score a change.
let lastScoreKey = null;
async function syncEventsIfScoreChanged(matchId, apifId, psgApiId, scoreA, scoreB) {
  const key = `${scoreA}:${scoreB}`;
  if (key === lastScoreKey) return 0;
  lastScoreKey = key;
  try {
    const ev = await apif(`/fixtures/events?fixture=${apifId}`);
    const rows = (ev.response || []).map((e) => ({
      match_id: matchId, minute: e.time?.elapsed ?? 0, extra_minute: e.time?.extra ?? null,
      type: mapEventType(e.type, e.detail),
      team_side: e.team?.id === psgApiId ? "home" : "away",
      player_name: e.player?.name ?? "",
      assist_player_name: e.assist?.name ?? null, detail: e.detail ?? null,
    }));
    await sb.from("match_events").delete().eq("match_id", matchId);
    if (rows.length) await sb.from("match_events").insert(rows);
    return rows.length;
  } catch { return 0; }
}

async function tick(matchId) {
  const fx = await findLiveFixture();
  if (!fx) {
    console.log(new Date().toLocaleTimeString(), "— pas encore live (ou deja FT). On attend.");
    return false;
  }
  const apifId = fx.fixture.id;
  const psgIsHome = isPsg(fx.teams.home.name);
  const psgApiId = psgIsHome ? fx.teams.home.id : fx.teams.away.id;
  const scorePsg = psgIsHome ? fx.goals.home : fx.goals.away;       // = team_a
  const scoreArs = psgIsHome ? fx.goals.away : fx.goals.home;       // = team_b
  const status = fx.fixture.status.short;
  const minute = fx.fixture.status.elapsed;
  const isFinished = FINISHED.includes(status);
  const isNotStarted = NOT_STARTED.includes(status);
  const appStatus = isFinished ? "finished" : isNotStarted ? "upcoming" : "live";

  const update = {
    status: appStatus,
    score_a: appStatus === "upcoming" ? null : (scorePsg ?? 0),
    score_b: appStatus === "upcoming" ? null : (scoreArs ?? 0),
    minute: appStatus === "upcoming" ? null : (minute ?? null),
    venue: fx.fixture.venue?.name ?? null,
    referee: fx.fixture.referee ?? null,
    updated_at: new Date().toISOString(),
  };
  await sb.from("matches").update(update).eq("id", matchId);

  // Stamp finished_at UNE SEULE FOIS au coup de sifflet final (meme logique que
  // services/football/sync.ts → stampFinishedAt). Sert au flash "Termine".
  if (appStatus === "finished") {
    await sb.from("matches")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", matchId)
      .is("finished_at", null);
  }

  // Compos une fois, events sur changement de score.
  const nLineup = await syncLineups(matchId, apifId, psgApiId);
  const nEv = await syncEventsIfScoreChanged(matchId, apifId, psgApiId, scorePsg ?? 0, scoreArs ?? 0);

  console.log(
    new Date().toLocaleTimeString(),
    `— PSG ${scorePsg ?? 0}-${scoreArs ?? 0} Arsenal [${status} ${minute || ""}'] | events ${nEv === 0 && lastScoreKey ? "(score inchange)" : `+${nEv}`} | compos ${nLineup ? "+" + nLineup : "(deja fait)"}`
  );
  return isFinished;
}

(async () => {
  if (!KEY) { console.error("Manque API_FOOTBALL_KEY"); process.exit(1); }
  const mode = process.argv[2] || "auto";
  const matchId = await getMatchId();

  if (mode === "reset") {
    await sb.from("match_events").delete().eq("match_id", matchId);
    await sb.from("match_lineups").delete().eq("match_id", matchId);
    await sb.from("match_stats").delete().eq("match_id", matchId);
    await sb.from("matches").update({
      status: "upcoming", score_a: null, score_b: null, minute: null, finished_at: null,
    }).eq("id", matchId);
    console.log("✅ Remis en 'upcoming' (finished_at nettoye).");
    return;
  }
  if (mode === "once") { await tick(matchId); return; }

  console.log(`▶ Sync live PSG-Arsenal toutes les ${POLL_MS / 1000}s. Ctrl+C pour arreter.`);
  console.log(`  Match id: ${matchId}`);
  const loop = async () => {
    try {
      if (await tick(matchId)) { console.log("✅ Match termine, settlement gere par l'app au prochain /api/matches."); process.exit(0); }
    } catch (e) { console.warn("tick KO:", e.message); }
    setTimeout(loop, POLL_MS);
  };
  loop();
})();
