// seed-pressure-demo.js — remplit match_pressure avec des snapshots SYNTHÉTIQUES
// pour VOIR la barre de pression tout de suite (sans attendre un vrai live).
//
// La vraie courbe est dérivée des stats API-Football captées en direct ; sur un
// match de SIMULATION (sans apif_id) ou hors match, rien ne se capte → ce script
// fabrique des données crédibles (cumulatives, avec vagues de momentum) pour la
// démo. Idempotent : il efface d'abord les snapshots du match ciblé.
//
//   node scripts/seed-pressure-demo.js              → 1er match live/halftime trouvé
//   node scripts/seed-pressure-demo.js <matchId>    → match précis (uuid)
//   node scripts/seed-pressure-demo.js <matchId> clear  → efface seulement
//
// Prérequis : migration supabase/migration_match_pressure_v1.sql jouée, et
// SUPABASE_SERVICE_ROLE_KEY dans .env.local.

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
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const maybeId = args.find((a) => /^[0-9a-f-]{36}$/i.test(a));
const clearOnly = args.includes("clear");

async function pickMatch() {
  if (maybeId) {
    const { data } = await sb.from("matches").select("id, team_a, team_b, minute, status").eq("id", maybeId).single();
    return data;
  }
  // 1er match en cours, sinon le plus récemment démarré.
  const live = await sb.from("matches").select("id, team_a, team_b, minute, status")
    .in("status", ["live", "halftime"]).order("starts_at", { ascending: false }).limit(1);
  if (live.data && live.data[0]) return live.data[0];
  const any = await sb.from("matches").select("id, team_a, team_b, minute, status")
    .order("starts_at", { ascending: false }).limit(1);
  return any.data && any.data[0];
}

(async () => {
  const m = await pickMatch();
  if (!m) { console.error("Aucun match trouvé. Passe un id : node scripts/seed-pressure-demo.js <matchId>"); process.exit(1); }
  console.log(`Match : ${m.team_a} vs ${m.team_b} — ${m.status} ${m.minute ?? "?"}' (${m.id})`);

  // Repart propre.
  const del = await sb.from("match_pressure").delete().eq("match_id", m.id);
  if (del.error) {
    console.error("⚠ delete match_pressure :", del.error.message);
    if (/relation .*match_pressure.* does not exist/i.test(del.error.message)) {
      console.error("→ Joue d'abord la migration supabase/migration_match_pressure_v1.sql sur Supabase.");
    }
    process.exit(1);
  }
  if (clearOnly) { console.log("Snapshots effacés."); process.exit(0); }

  const M = Math.max(10, Math.min(90, m.minute || 60)); // minute de jeu couverte
  const count = Math.max(6, Math.round(M * 2));          // ~2 snapshots / minute (30 s)
  const tBase = Math.floor(Date.now() / 30000) - count + 1; // buckets 30 s consécutifs finissant ~maintenant

  // Cumuls par camp. À chaque tranche, le camp qui "pousse" suit une vague de
  // momentum (sin) → alternance de phases vertes (A) et bleues (B).
  const h = { sog: 0, shots: 0, inbox: 0, corners: 0, xg: 0 };
  const a = { sog: 0, shots: 0, inbox: 0, corners: 0, xg: 0 };
  const rnd = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
  const rows = [];
  for (let i = 0; i < count; i++) {
    const mom = Math.sin(i / 7) + 0.35 * Math.sin(i / 2.3); // -1.35..1.35
    const homeShare = Math.max(0.18, Math.min(0.82, 0.5 + 0.32 * mom));
    if (rnd() < 0.78) {
      const side = rnd() < homeShare ? h : a;
      side.shots += 1;
      if (rnd() < 0.45) side.sog += 1;
      if (rnd() < 0.6) side.inbox += 1;
      if (rnd() < 0.22) side.corners += 1;
      side.xg = +(side.xg + rnd() * 0.18).toFixed(3);
    }
    const possH = Math.round(homeShare * 100);
    const minute = Math.round((i / (count - 1)) * M);
    rows.push({
      match_id: m.id,
      t: tBase + i,
      minute,
      stats: {
        home: { ...h, poss: possH },
        away: { ...a, poss: 100 - possH },
      },
    });
  }

  const ins = await sb.from("match_pressure").upsert(rows, { onConflict: "match_id,t" });
  if (ins.error) { console.error("⚠ insert :", ins.error.message); process.exit(1); }
  console.log(`✅ ${rows.length} snapshots injectés (≈${M}' de jeu). Ouvre la fiche → onglet Timeline.`);
  process.exit(0);
})();
