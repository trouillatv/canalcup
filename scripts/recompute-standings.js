// One-shot — recalcule les classements de POULE depuis nos matchs terminés.
//
// Pourquoi : l'endpoint /standings d'API-Football est parfois EN RETARD (il
// renvoyait encore 2 journées alors que des J3 sont jouées). On recalcule donc
// played/won/draw/lost/goals/points/rank depuis la table `matches` (source à
// jour), en mettant à jour les lignes `standings` existantes (UPDATE in place).
//
// Départage : points > diff de buts > buts marqués (approximation FIFA ;
// la confrontation directe n'est pas calculée — suffisant pour l'affichage).
//
// Dry-run par défaut ; écrit seulement avec --apply.
// Usage : node scripts/recompute-standings.js [--apply]

const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APPLY = process.argv.includes("--apply");
const COMP = ["FIFA World Cup 2026", "Coupe du Monde 2026"];
const norm = (s) => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

(async () => {
  const [{ data: standings }, { data: matches }] = await Promise.all([
    sb.from("standings").select("*").in("competition", COMP),
    sb.from("matches").select("team_a, team_b, score_a, score_b, status").in("competition", COMP).eq("phase", "Groupe"),
  ]);
  if (!standings || !standings.length) { console.error("Aucune ligne standings — abort."); process.exit(1); }

  // Registre équipe -> ligne standings (clé par nom EN et FR normalisés).
  const rowByKey = new Map();
  for (const r of standings) {
    rowByKey.set(norm(r.team_name), r);
    rowByKey.set(norm(r.team_name_fr), r);
  }
  // Stats agrégées par id de ligne standings.
  const stat = new Map();
  for (const r of standings) stat.set(r.id, { played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, pts: 0 });

  let used = 0, unmatched = new Set();
  const bump = (name, gf, ga) => {
    const r = rowByKey.get(norm(name));
    if (!r) { unmatched.add(name); return; }
    const s = stat.get(r.id);
    s.played++; s.gf += gf; s.ga += ga;
    if (gf > ga) { s.won++; s.pts += 3; } else if (gf === ga) { s.draw++; s.pts += 1; } else s.lost++;
  };
  for (const m of matches || []) {
    if (m.status !== "finished" || m.score_a == null || m.score_b == null) continue;
    bump(m.team_a, m.score_a, m.score_b);
    bump(m.team_b, m.score_b, m.score_a);
    used++;
  }
  if (unmatched.size) console.warn("⚠️ équipes non rattachées:", [...unmatched].join(", "));

  // Rang par groupe (points > diff > buts pour).
  const byGroup = {};
  for (const r of standings) (byGroup[r.group_name] = byGroup[r.group_name] || []).push(r);
  const rankById = new Map();
  for (const g of Object.keys(byGroup)) {
    const sorted = byGroup[g].slice().sort((a, b) => {
      const sa = stat.get(a.id), sb2 = stat.get(b.id);
      return sb2.pts - sa.pts || (sb2.gf - sb2.ga) - (sa.gf - sa.ga) || sb2.gf - sa.gf || norm(a.team_name_fr).localeCompare(norm(b.team_name_fr));
    });
    sorted.forEach((r, i) => rankById.set(r.id, i + 1));
  }

  let changed = 0;
  for (const r of standings) {
    const s = stat.get(r.id);
    const next = { played: s.played, won: s.won, draw: s.draw, lost: s.lost, goals_for: s.gf, goals_against: s.ga, goal_diff: s.gf - s.ga, points: s.pts, rank: rankById.get(r.id) };
    const diff = ["played", "won", "draw", "lost", "goals_for", "goals_against", "goal_diff", "points", "rank"].some((k) => (r[k] ?? 0) !== next[k]);
    if (!diff) continue;
    changed++;
    console.log(`${r.group_name} ${r.team_name_fr}: J${r.played}->${next.played} ${r.points}->${next.points}pts (rg ${r.rank}->${next.rank})`);
    if (APPLY) {
      const { error } = await sb.from("standings").update(next).eq("id", r.id);
      if (error) console.error("  ✗", error.message);
    }
  }
  console.log(`\n${APPLY ? "✅ Appliqué" : "[dry-run]"} : ${used} matchs comptés, ${changed} ligne(s) modifiée(s) sur ${standings.length}.`);
  if (!APPLY && changed) console.log("→ relance avec --apply pour écrire.");
})();
