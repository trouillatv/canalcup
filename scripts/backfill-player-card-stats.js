// Backfill player_match_stats : minutes / started / duels_won / key_passes.
//
// Ces 4 colonnes (migration_player_match_stats_card_v1.sql) alimentent la fiche
// joueur football (Forme / Mondial / Indice Dangerosité). La synchro live les
// remplit désormais à chaque match ; ce script rattrape les matchs DÉJÀ joués.
//
// Source : API-Football /fixtures/players?fixture={apif_id} (mêmes données que
// la synchro). On met à jour les lignes existantes par (match_id, player_id) —
// on NE crée jamais de ligne, on ne touche pas aux notes/buts/passes déjà là.
//
// Usage :
//   node scripts/backfill-player-card-stats.js              # tous les matchs finished
//   node scripts/backfill-player-card-stats.js --dry-run    # n'écrit rien
//   node scripts/backfill-player-card-stats.js --limit 5    # limite le nb de matchs

const https = require("https");
const fs = require("fs");
const path = require("path");

// ─── Env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const [k, ...v] = line.split("=");
    if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
  });
}
const PAT = process.env.SUPABASE_PAT;
const REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)/)?.[1];
const APIF_KEY = process.env.API_FOOTBALL_KEY;
if (!PAT || !REF || !APIF_KEY) {
  console.error("SUPABASE_PAT, NEXT_PUBLIC_SUPABASE_URL et API_FOOTBALL_KEY requis dans .env.local");
  process.exit(1);
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const limitArg = argv.indexOf("--limit");
const LIMIT = limitArg >= 0 ? parseInt(argv[limitArg + 1], 10) : null;

function runSQL(query) {
  return new Promise((res, rej) => {
    const b = JSON.stringify({ query });
    const r = https.request(
      { hostname: "api.supabase.com", path: `/v1/projects/${REF}/database/query`, method: "POST",
        headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(b) } },
      (x) => { let d = ""; x.on("data", (c) => (d += c)); x.on("end", () => {
        let p; try { p = JSON.parse(d || "[]"); } catch { return rej(new Error(d.slice(0, 300))); }
        if (p && p.message) return rej(new Error(p.message)); res(p);
      }); }
    );
    r.on("error", rej); r.write(b); r.end();
  });
}

function apif(fixtureId) {
  return new Promise((res, rej) => {
    https.get(
      { hostname: "v3.football.api-sports.io", path: `/fixtures/players?fixture=${fixtureId}`, headers: { "x-apisports-key": APIF_KEY } },
      (x) => { let d = ""; x.on("data", (c) => (d += c)); x.on("end", () => {
        try { res(JSON.parse(d)); } catch { rej(new Error(d.slice(0, 200))); }
      }); }
    ).on("error", rej);
  });
}

const TAG = "$cc_bf$";

(async () => {
  let matches = await runSQL(
    "select id, apif_id, team_a, team_b from public.matches where status='finished' and apif_id is not null order by starts_at desc;"
  );
  if (LIMIT) matches = matches.slice(0, LIMIT);
  console.log(`[backfill] ${matches.length} matchs finished${dryRun ? " (DRY-RUN)" : ""}`);

  let touched = 0, players = 0;
  for (const m of matches) {
    const json = await apif(m.apif_id);
    if (json.errors && Object.keys(json.errors).length) { console.warn(`  ⚠️ ${m.team_a}-${m.team_b}: ${JSON.stringify(json.errors)}`); continue; }
    const resp = json.response ?? [];
    if (resp.length < 2) { console.log(`  ${m.team_a}-${m.team_b}: pas de données joueurs`); continue; }

    const updates = [];
    for (const block of resp) {
      for (const entry of block.players ?? []) {
        const pid = entry?.player?.id;
        if (pid == null) continue;
        const st = entry.statistics?.[0] ?? {};
        const sub = st.games?.substitute;
        updates.push({
          player_id: String(pid),
          minutes: st.games?.minutes ?? null,
          started: sub == null ? null : !sub,
          duels_won: st.duels?.won ?? null,
          key_passes: st.passes?.key ?? null,
        });
      }
    }
    if (!updates.length) continue;
    players += updates.length;

    if (dryRun) {
      console.log(`  (dry) ${m.team_a}-${m.team_b}: ${updates.length} joueurs`);
    } else {
      const j = JSON.stringify(updates);
      if (j.includes(TAG)) throw new Error("conflit dollar-quoting");
      // update ... from jsonb_to_recordset : 1 requête par match.
      const sql =
        `update public.player_match_stats s set ` +
        `minutes=u.minutes, started=u.started, duels_won=u.duels_won, key_passes=u.key_passes ` +
        `from jsonb_to_recordset(${TAG}${j}${TAG}::jsonb) ` +
        `as u(player_id text, minutes int, started boolean, duels_won int, key_passes int) ` +
        `where s.match_id='${m.id}' and s.player_id = u.player_id;`;
      await runSQL(sql);
      console.log(`  ✅ ${m.team_a}-${m.team_b}: ${updates.length} joueurs`);
      touched++;
    }
  }
  console.log(`[backfill] terminé — ${touched} matchs mis à jour, ${players} lignes joueur vues.`);
})().catch((e) => { console.error("[backfill] ❌", e.message); process.exit(1); });
