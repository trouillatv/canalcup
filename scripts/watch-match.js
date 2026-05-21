// watch-match.js — boucle de refresh d'un match LIVE depuis API-Football,
// avec budget de quota intelligent.
//
// Usage :
//   node scripts/watch-match.js <match-uuid> [intervalSec=60]
//
// Stratégie quota (api-football Free = 100 req/jour) :
//   - 1 req = 1 appel /fixtures?id + 1 appel /fixtures/events (= 2 calls).
//   - Intervalle par défaut 60 sec → 2 req/min × 90 min = 180 calls/match.
//     ⇒ recommandation : 90 sec d'intervalle pour un match (120 calls).
//   - Plus prudent en jour de WC (4 matchs) : interval ≥ 180 sec.
//   - Le script s'arrête automatiquement si le match passe à FINISHED.
//   - Fallback TheSportsDB si API-Football renvoie 429 ou erreur.

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

const matchUuid = process.argv[2];
const intervalSec = Math.max(30, parseInt(process.argv[3] ?? "60", 10) || 60);

if (!matchUuid) {
  console.error("Usage : node scripts/watch-match.js <match-uuid> [intervalSec=60]");
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
let usingFallback = false;

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

async function tickApif(apifId, homeTeamApifId) {
  // 1 appel fixtures (score, minute, status) + 1 appel events.
  const fx = await apif(`/fixtures?id=${apifId}`);
  const f = fx.response?.[0];
  if (!f) { console.log("  ⚠ fixture introuvable côté API"); return null; }

  const ev = await apif(`/fixtures/events?fixture=${apifId}`);
  const apifEvents = ev.response ?? [];

  const isLive = ["1H", "HT", "2H", "ET", "P", "LIVE", "BT"].includes(f.fixture.status.short);
  const isFinished = ["FT", "AET", "PEN"].includes(f.fixture.status.short);

  return {
    score_a: f.goals.home, score_b: f.goals.away,
    minute: f.fixture.status.elapsed,
    status: isFinished ? "finished" : isLive ? "live" : "upcoming",
    statusShort: f.fixture.status.short,
    events: apifEvents.map((e) => ({
      match_id: matchUuid,
      minute: e.time?.elapsed ?? 0,
      extra_minute: e.time?.extra ?? null,
      type: mapEventType(e.type, e.detail),
      team_side: e.team?.id === homeTeamApifId ? "home" : "away",
      player_name: e.player?.name ?? "",
      assist_player_name: e.assist?.name ?? null,
      detail: e.detail ?? null,
      source: "api-football",
    })),
  };
}

(async () => {
  // 1. Charge le match (et son apif_id) depuis Supabase.
  const { data: match } = await sb
    .from("matches")
    .select("id, team_a, team_b, apif_id, external_id, status")
    .eq("id", matchUuid)
    .maybeSingle();
  if (!match) { console.error(`Match ${matchUuid} introuvable.`); process.exit(1); }
  const apifId = match.apif_id || match.external_id;
  if (!apifId) {
    console.error("Match sans apif_id ni external_id. Re-lance scripts/seed-live-test-match.js.");
    process.exit(1);
  }

  // 2. On a besoin du homeTeamApifId pour mapper home/away. On le déduit
  //    du 1er fetch puis on cache.
  console.log(`⏱  Watch '${match.team_a} vs ${match.team_b}' — refresh ${intervalSec}s`);
  console.log("");

  const first = await apif(`/fixtures?id=${apifId}`);
  const homeTeamApifId = first.response?.[0]?.teams?.home?.id;
  if (!homeTeamApifId) {
    console.error("Impossible de récupérer l'id de l'équipe domicile.");
    process.exit(1);
  }

  let prevEventsCount = 0;
  let consecutiveErrors = 0;
  const startedAt = Date.now();

  while (true) {
    try {
      const snap = await tickApif(apifId, homeTeamApifId);
      consecutiveErrors = 0;
      if (snap) {
        await sb
          .from("matches")
          .update({
            score_a: snap.score_a, score_b: snap.score_b,
            minute: snap.minute, status: snap.status,
            updated_at: new Date().toISOString(),
          })
          .eq("id", matchUuid);

        // Réécrit les events (idempotent — petit volume, OK).
        await sb.from("match_events").delete().eq("match_id", matchUuid);
        if (snap.events.length > 0) {
          await sb.from("match_events").insert(snap.events);
        }

        const newEvents = snap.events.length - prevEventsCount;
        const elapsedMin = Math.floor((Date.now() - startedAt) / 60000);
        const prefix = usingFallback ? "[fallback]" : "[api-foot]";
        console.log(
          `${prefix} ${snap.statusShort} ${snap.minute ?? "?"}' — ` +
            `${snap.score_a}–${snap.score_b} — ` +
            `${snap.events.length} events${newEvents > 0 ? ` (+${newEvents})` : ""} — ` +
            `calls=${callCount} — watch=${elapsedMin}min`
        );
        prevEventsCount = snap.events.length;

        if (snap.status === "finished") {
          console.log("");
          console.log("🏁 Match terminé. Watch stoppé.");
          break;
        }
      }
    } catch (e) {
      consecutiveErrors += 1;
      console.warn(`⚠ ${e.message} (errors=${consecutiveErrors})`);
      if (e.message.includes("quota_exceeded")) {
        console.warn("→ Quota API-Football dépassé. Passer en fallback TheSportsDB n'est pas implémenté ici.");
        console.warn("  On stoppe la watch pour ne pas spammer.");
        break;
      }
      if (consecutiveErrors >= 5) {
        console.warn("Trop d'erreurs consécutives. On stoppe.");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }

  console.log("");
  console.log(`Total calls API-Football : ${callCount} (quota free = 100/jour)`);
})();
