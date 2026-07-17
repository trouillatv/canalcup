// One-shot (17/07/2026) — Les Chouchouz déclarent forfait au tournoi baby-foot.
//
// Décisions actées par l'organisation :
//   • Les Chouchouz : forfait → 0 point (pas même les 5 de participation) ;
//   • leur match contre Les lions de PARIS est perdu PAR FORFAIT (0-10) : les
//     Lions encaissent la victoire (match joué + victoire) ;
//   • leurs 2 autres matchs (vs ChoubiX et vs le FC) tombent → pour que ces deux
//     binômes disputent quand même leur 3e match, ChoubiX affronte le FC
//     (« Roberta ») sur le créneau de vendredi 11h00, et le match Chouchouz–le FC
//     est supprimé ;
//   • ChoubiX a en réalité joué avec Leila (et non Monalisa) → l'inscription
//     devient une PAIRE AD-HOC Mohéa + Leila : points individuels aux deux,
//     aucun point pour l'équipe RSE ChoubiX, aucun point pour Monalisa.
//
// Le recalcul du registre en fin de script est un PROVISOIRE : le moteur serveur
// (recomputeAwards) le réécrit à l'identique dès la saisie d'un score.
//
//   node scripts/babyfoot-forfait-chouchouz.js          (dry-run : n'écrit rien)
//   node scripts/babyfoot-forfait-chouchouz.js --apply  (applique)

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

const APPLY = process.argv.includes("--apply");
const BAREME = { participation: 5, matchPlayed: 5, matchWin: 5, qualified: 10 };
const QUALIFIERS = 4;

const CHOUCHOUZ = "Les Chouchouz";
const CHOUBIX = "ChoubiX";
const LE_FC = "le FC (Finance Compta)";
const LIONS = "Les lions de PARIS";
const MOHEA_EMAIL = "mohea.mens@canal-plus.com";
const LEILA_EMAIL = "leila.wohler@canal-plus.com";

const log = (...a) => console.log(...a);
const step = (s) => log(`\n${APPLY ? "▶" : "·"} ${s}`);

(async () => {
  const { data: t } = await sb.from("babyfoot_tournaments").select("id, status").eq("kind", "official").eq("is_active", true).maybeSingle();
  if (!t) throw new Error("Aucune édition active.");

  const [{ data: entries }, { data: teams }, { data: users }, { data: matches }] = await Promise.all([
    sb.from("babyfoot_entries").select("id, team_id, kind, display_name, p1_user_id, p2_user_id, forfeited").eq("tournament_id", t.id),
    sb.from("teams").select("id, name"),
    sb.from("users").select("id, email"),
    sb.from("babyfoot_matches").select("id, entry_a_id, entry_b_id, team_a_id, team_b_id, score_a, score_b, status, phase, rotation, starts_at").eq("tournament_id", t.id),
  ]);
  const teamByName = new Map(teams.map((x) => [x.name, x.id]));
  const nameByTeam = new Map(teams.map((x) => [x.id, x.name]));
  const entryOf = (teamName) => entries.find((e) => e.team_id === teamByName.get(teamName));
  const userByEmail = (mail) => users.find((u) => u.email === mail);

  const eChouchouz = entryOf(CHOUCHOUZ), eChoubix = entryOf(CHOUBIX), eFC = entryOf(LE_FC), eLions = entryOf(LIONS);
  const mohea = userByEmail(MOHEA_EMAIL), leila = userByEmail(LEILA_EMAIL);
  for (const [k, v] of Object.entries({ eChouchouz, eChoubix, eFC, eLions, mohea, leila })) {
    if (!v) throw new Error(`Introuvable : ${k}`);
  }
  const lbl = (e) => nameByTeam.get(e.team_id) ?? e.id;

  // ── 1) Match de 11h : Chouchouz–ChoubiX devient le FC–ChoubiX ───────────────
  const mChoubix = matches.find((m) =>
    m.status !== "finished" &&
    [m.entry_a_id, m.entry_b_id].includes(eChouchouz.id) && [m.entry_a_id, m.entry_b_id].includes(eChoubix.id));
  const mFC = matches.find((m) =>
    m.status !== "finished" &&
    [m.entry_a_id, m.entry_b_id].includes(eChouchouz.id) && [m.entry_a_id, m.entry_b_id].includes(eFC.id));
  const mLions = matches.find((m) =>
    m.status !== "finished" &&
    [m.entry_a_id, m.entry_b_id].includes(eChouchouz.id) && [m.entry_a_id, m.entry_b_id].includes(eLions.id));
  if (!mChoubix || !mFC || !mLions) throw new Error("Les 3 matchs à venir des Chouchouz ne sont pas tous là.");

  step(`Match 11h : ${lbl(eFC)} vs ${lbl(eChoubix)} (créneau ${mChoubix.starts_at})`);
  if (APPLY) {
    const { error } = await sb.from("babyfoot_matches")
      .update({ entry_a_id: eFC.id, team_a_id: eFC.team_id, round: `${LE_FC} vs ${CHOUBIX}` })
      .eq("id", mChoubix.id);
    if (error) throw error;
  }

  step(`Suppression du match ${lbl(eChouchouz)} vs ${lbl(eFC)} (rot ${mFC.rotation})`);
  if (APPLY) {
    const { error } = await sb.from("babyfoot_matches").delete().eq("id", mFC.id);
    if (error) throw error;
  }

  // ── 2) Forfait : Lions gagnent 10-0 ────────────────────────────────────────
  const lionsIsA = mLions.entry_a_id === eLions.id;
  const [sa, sb_] = lionsIsA ? [10, 0] : [0, 10];
  step(`Forfait : ${lbl(eChouchouz)} ${lionsIsA ? sb_ : sa}-${lionsIsA ? sa : sb_} ${lbl(eLions)} (victoire des Lions)`);
  if (APPLY) {
    const { error } = await sb.from("babyfoot_matches")
      .update({ score_a: sa, score_b: sb_, status: "finished", highlight: "Victoire par forfait" })
      .eq("id", mLions.id);
    if (error) throw error;
  }

  // ── 3) Chouchouz forfait (0 point) ─────────────────────────────────────────
  step(`${CHOUCHOUZ} : forfeited = true → 0 point`);
  if (APPLY) {
    const { error } = await sb.from("babyfoot_entries").update({ forfeited: true }).eq("id", eChouchouz.id);
    if (error) throw error;
  }

  // ── 4) ChoubiX = paire ad-hoc Mohéa + Leila ────────────────────────────────
  step(`${CHOUBIX} : paire ad-hoc Mohéa + Leila (points individuels, aucun point équipe, Monalisa non créditée)`);
  if (APPLY) {
    const { error } = await sb.from("babyfoot_entries")
      .update({ kind: "open", p1_user_id: mohea.id, p2_user_id: leila.id, p2_is_helper: false, display_name: CHOUBIX })
      .eq("id", eChoubix.id);
    if (error) throw error;
  }

  // ── 5) Registre des points (provisoire, même barème que recomputeAwards) ────
  const { data: freshEntries } = await sb.from("babyfoot_entries").select("id, team_id, kind, forfeited").eq("tournament_id", t.id);
  const { data: freshMatches } = await sb.from("babyfoot_matches").select("entry_a_id, entry_b_id, score_a, score_b, status, phase").eq("tournament_id", t.id);
  const live = APPLY ? { entries: freshEntries, matches: freshMatches } : null;

  if (live) {
    const acc = new Map(live.entries.map((e) => [e.id, { e, played: 0, won: 0, gf: 0, ga: 0 }]));
    for (const m of live.matches) {
      if (m.phase !== "league" || m.status !== "finished" || m.score_a == null || m.score_b == null) continue;
      for (const [id, mine, theirs] of [[m.entry_a_id, m.score_a, m.score_b], [m.entry_b_id, m.score_b, m.score_a]]) {
        const s = id && acc.get(id);
        if (!s) continue;
        s.played++; s.gf += mine; s.ga += theirs;
        if (mine > theirs) s.won++;
      }
    }
    const ranked = [...acc.values()]
      .filter((s) => !s.e.forfeited)
      .sort((a, b) => b.won - a.won || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);
    const qualified = new Set(ranked.slice(0, QUALIFIERS).map((s) => s.e.id));

    const rows = [];
    for (const s of acc.values()) {
      if (s.e.forfeited) continue;
      const teamId = s.e.kind === "open" ? null : s.e.team_id;
      const base = { tournament_id: t.id, entry_id: s.e.id, team_id: teamId };
      rows.push({ ...base, stage: "participation", points: BAREME.participation, label: "Participation" });
      const pts = s.played * BAREME.matchPlayed + s.won * BAREME.matchWin;
      if (pts > 0) rows.push({ ...base, stage: "phase1", points: pts, label: `${s.played} match(s) joué(s), ${s.won} gagné(s)` });
      if (qualified.has(s.e.id)) rows.push({ ...base, stage: "qualified", points: BAREME.qualified, label: "Qualifié en demi-finale" });
    }
    step("Réécriture du registre des points");
    await sb.from("babyfoot_awards").delete().eq("tournament_id", t.id);
    const { error } = await sb.from("babyfoot_awards").insert(rows);
    if (error) throw error;

    const total = new Map();
    for (const r of rows) total.set(r.entry_id, (total.get(r.entry_id) ?? 0) + r.points);
    log("\nPoints par binôme :");
    for (const s of [...acc.values()]) {
      const nm = nameByTeam.get(s.e.team_id) ?? s.e.id;
      log(`  ${String(total.get(s.e.id) ?? 0).padStart(3)} pts · ${nm}${s.e.forfeited ? " (FORFAIT)" : ""}${s.e.kind === "open" ? " [paire ad-hoc → 0 pt équipe]" : ""}`);
    }
  }

  log(APPLY ? "\n✅ Appliqué." : "\n(dry-run — relancer avec --apply)");
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
