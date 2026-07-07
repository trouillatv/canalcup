// resync-events-mismatched.js — rattrape les match_events des matchs FINIS dont
// le nombre de buts en events ne colle pas au score (synchro live coupée en
// cours → buts manquants, ou events erronés). Pour chaque match incohérent :
// re-fetch API-Football (fixture pour l'id home + events), puis delete + insert.
//
// Usage : node scripts/resync-events-mismatched.js         (corrige)
//         node scripts/resync-events-mismatched.js --dry   (liste seulement)

const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((l) => {
    const [k, ...v] = l.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
const { createClient } = require("@supabase/supabase-js");
const KEY = process.env.API_FOOTBALL_KEY;
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const DRY = process.argv.includes("--dry");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function mapEventType(t, d) {
  const T = (t || "").toLowerCase();
  const D = (d || "").toLowerCase();
  if (T === "goal") return "goal";
  if (T === "card") return D.includes("red") ? "red_card" : "yellow_card";
  if (T === "subst") return "substitution";
  if (T === "var") return "var";
  return "goal";
}
async function apif(p) {
  const res = await fetch(`https://v3.football.api-sports.io${p}`, { headers: { "x-apisports-key": KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

(async () => {
  if (!KEY) { console.error("API_FOOTBALL_KEY manquante"); process.exit(1); }

  const { data: rows } = await sb
    .from("matches")
    .select("id, team_a, team_b, score_a, score_b, apif_id, external_id, status")
    .eq("status", "finished")
    .not("score_a", "is", null)
    .not("score_b", "is", null);

  const targets = [];
  for (const m of rows ?? []) {
    const { data: evs } = await sb
      .from("match_events")
      .select("type, detail")
      .eq("match_id", m.id);
    const goals = (evs ?? []).filter((e) => e.type === "goal" && !/(missed)/i.test(e.detail || "")).length;
    if (m.score_a + m.score_b !== goals) {
      targets.push({ ...m, buts_score: m.score_a + m.score_b, buts_events: goals });
    }
  }

  console.log(`Matchs incohérents : ${targets.length}`);
  for (const t of targets) {
    console.log(`  ${t.team_a} ${t.score_a}-${t.score_b} ${t.team_b} | events=${t.buts_events} vs score=${t.buts_score} | apif=${t.apif_id ?? t.external_id ?? "—"}`);
  }
  if (DRY) { console.log("[--dry] aucune écriture."); return; }

  let fixed = 0, skipped = 0, calls = 0;
  for (const t of targets) {
    const apifId = t.apif_id || t.external_id;
    if (!apifId) { console.log(`⏭  ${t.team_a}-${t.team_b} : pas d'apif_id`); skipped++; continue; }
    try {
      const fx = await apif(`/fixtures?id=${apifId}`); calls++;
      const homeId = fx.response?.[0]?.teams?.home?.id;
      if (!homeId) { console.log(`⏭  ${t.team_a}-${t.team_b} : id home introuvable`); skipped++; continue; }
      const ev = await apif(`/fixtures/events?fixture=${apifId}`); calls++;
      const raw = ev.response ?? [];
      const events = raw.map((e) => ({
        match_id: t.id,
        minute: e.time?.elapsed ?? 0,
        extra_minute: e.time?.extra ?? null,
        type: mapEventType(e.type, e.detail),
        team_side: e.team?.id === homeId ? "home" : "away",
        player_name: e.player?.name ?? "",
        assist_player_name: e.assist?.name ?? null,
        detail: e.detail ?? null,
      }));
      await sb.from("match_events").delete().eq("match_id", t.id);
      if (events.length) await sb.from("match_events").insert(events);
      const newGoals = events.filter((e) => e.type === "goal" && !/(missed)/i.test(e.detail || "")).length;
      console.log(`✅ ${t.team_a}-${t.team_b} : ${events.length} events (${newGoals} buts, score ${t.buts_score})${newGoals !== t.buts_score ? " ⚠ toujours != score" : ""}`);
      fixed++;
      await sleep(400); // gentle sur l'API
    } catch (e) {
      console.log(`⚠ ${t.team_a}-${t.team_b} : ${e.message}`);
      skipped++;
    }
  }
  console.log(`\nTerminé : ${fixed} corrigés, ${skipped} ignorés, ${calls} appels API.`);
})();
