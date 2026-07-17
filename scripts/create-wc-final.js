// One-shot (17/07/2026) — crée la FINALE de la Coupe du Monde 2026.
//
// Pourquoi à la main : le plan API-Football gratuit n'a plus accès à la saison
// WC 2026, et la fenêtre TheSportsDB ne renvoie plus que 2 événements (ni la
// finale). Sans la ligne en base, la carte de prono n'apparaît jamais et
// personne ne peut parier (cas déjà vécu sur Argentine–Suisse).
//
// L'affiche est DÉDUITE des demies déjà réglées en base (vainqueurs), jamais
// codée en dur : si les demies ne sont pas terminées, le script refuse.
//
//   node scripts/create-wc-final.js          (dry-run)
//   node scripts/create-wc-final.js --apply
const fs = require("fs");
const path = require("path");
fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8").split("\n").forEach((l) => {
  const [k, ...v] = l.split("=");
  if (k && v.length && !process.env[k.trim()]) process.env[k.trim()] = v.join("=").trim();
});
const { createClient } = require("@supabase/supabase-js");
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const APPLY = process.argv.includes("--apply");
const KICKOFF = "2026-07-19T19:00:00+00:00"; // 15h00 à New York = 6h00 lundi en NC
const VENUE = "MetLife Stadium";

(async () => {
  const { data: semis } = await sb.from("matches").select("*").eq("phase", "Demis");
  if (!semis?.length || !semis.every((m) => m.status === "finished" && m.score_a != null)) {
    throw new Error("Les demi-finales ne sont pas toutes terminées — affiche indéterminable.");
  }
  // Vainqueur au score final (tirs au but inclus si renseignés).
  const winner = (m) => {
    const a = m.pen_a != null && m.pen_b != null && m.score_a === m.score_b ? m.pen_a : m.score_a;
    const b = m.pen_a != null && m.pen_b != null && m.score_a === m.score_b ? m.pen_b : m.score_b;
    if (a === b) throw new Error(`Demi sans vainqueur : ${m.team_a} vs ${m.team_b}`);
    return a > b
      ? { name: m.team_a, flag: m.flag_a }
      : { name: m.team_b, flag: m.flag_b };
  };
  const ordered = [...semis].sort((x, y) => x.starts_at.localeCompare(y.starts_at));
  const [w1, w2] = ordered.map(winner);

  const { data: existing } = await sb
    .from("matches").select("id, team_a, team_b, starts_at")
    .eq("phase", "Finale").eq("competition", "FIFA World Cup 2026").maybeSingle();

  const row = {
    competition: "FIFA World Cup 2026",
    phase: "Finale",
    team_a: w1.name, team_b: w2.name,
    flag_a: w1.flag, flag_b: w2.flag,
    starts_at: KICKOFF,
    channel: "Canal+",
    status: "upcoming",
    venue: VENUE,
    is_featured: true,
    is_match_of_week: true,
    is_settled: false,
  };

  console.log(`Demies : ${ordered.map((m) => `${m.team_a} ${m.score_a}-${m.score_b} ${m.team_b}`).join(" | ")}`);
  console.log(`\nFINALE ${row.flag_a} ${row.team_a} vs ${row.team_b} ${row.flag_b}`);
  console.log(`  coup d'envoi : ${KICKOFF} (${new Date(KICKOFF).toLocaleString("fr-FR", { timeZone: "Pacific/Noumea", weekday: "long", hour: "2-digit", minute: "2-digit" })} en NC)`);
  console.log(`  lieu : ${VENUE} · chaîne : Canal+ · match de la semaine + à la une`);
  console.log(`  ${existing ? `→ MISE À JOUR de la ligne existante (${existing.team_a} vs ${existing.team_b})` : "→ INSERTION d'une nouvelle ligne"}`);

  if (!APPLY) return console.log("\n(dry-run — relancer avec --apply)");
  const { error } = existing
    ? await sb.from("matches").update(row).eq("id", existing.id)
    : await sb.from("matches").insert(row);
  if (error) throw error;
  console.log("\n✅ Finale créée — les pronos sont ouverts.");
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
