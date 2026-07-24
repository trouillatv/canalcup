/**
 * Import des données de match transcrites depuis des captures (idempotent).
 *
 *   node scripts/import-match-captures.js                → DRY-RUN, tous les fichiers
 *   node scripts/import-match-captures.js --apply        → applique
 *   node scripts/import-match-captures.js <fichier.json> → cible un seul match
 *
 * Source : data/matches/*.json, transcrits à la main depuis public/Matchs/*.png.
 * Le format porte sa propre provenance (bloc `source`) et un niveau de
 * confiance par valeur — on doit pouvoir retrouver plus tard toute donnée
 * incertaine sans relire les captures.
 *
 * Pourquoi ce script existe : le plan API-Football gratuit ne couvre pas la
 * CdM 2026. Les matchs de phase finale n'ont donc ni compositions, ni notes,
 * ni événements — le centre du match est vide. Les captures Sofascore sont la
 * seule source disponible.
 *
 * Ce qu'il NE fait PAS :
 *   - inventer les données absentes des captures (stats d'équipe, minutes de
 *     cartons, remplacements) : elles sont listées telles quelles dans le
 *     résumé de complétude, en creux ;
 *   - apparier les noms abrégés Sofascore à des joueurs canoniques. Il écrit
 *     un alias non résolu dans player_aliases : le rattachement se fera plus
 *     tard, sans réimport.
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const ROOT = path.join(__dirname, "..");
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const TARGET = args.find((a) => a.endsWith(".json"));
const DATA_DIR = path.join(ROOT, "data", "matches");

const SIDE = { a: "home", b: "away" };

// ── Résumé de complétude ─────────────────────────────────────────────────────
// En une seconde on doit voir ce qui est là et ce qui manque.
function completeness(doc) {
  const ll = doc.lineups ?? [];
  const rated = ll.filter((p) => typeof p.rating === "number");
  const cards = ll.filter((p) => p.yellow_cards || p.red_cards);
  const subs = ll.filter((p) => p.subbed_off);

  const lignes = [
    [!!doc.referee?.name, `arbitre${doc.referee?.name ? ` — ${doc.referee.name}` : ""}`],
    [!!(doc.managers?.a?.name && doc.managers?.b?.name),
      (() => {
        const manquants = ["a", "b"].filter((s) => !doc.managers?.[s]?.name);
        if (!manquants.length) return "entraîneurs";
        const noms = manquants.map((s) => (s === "a" ? doc.match.team_a : doc.match.team_b));
        return `entraîneur${noms.length > 1 ? "s" : ""} ${noms.join(" et ")} non visible${noms.length > 1 ? "s" : ""} sur la capture`;
      })()],
    [!!(doc.formations?.a?.value && doc.formations?.b?.value),
      `formations${doc.formations?.a?.value ? ` — ${doc.formations.a.value} / ${doc.formations.b.value}` : ""}`],
    [ll.length > 0, `${ll.length} joueurs`],
    [rated.length > 0, `${rated.length} notes`],
    [!!doc.motm?.player_name, `homme du match${doc.motm?.player_name ? ` — ${doc.motm.player_name}` : ""}`],
    [(doc.events ?? []).length > 0, `${(doc.events ?? []).length} événement(s) — buteurs`],
    [cards.length > 0, `${cards.length} carton(s)`],
    [false, "statistiques d'équipe"],
    [false, "minutes des cartons"],
    [subs.length > 0, `${subs.length} sortie(s) constatée(s) (sans minute ni entrant)`],
  ];

  // Confiance globale : moyenne de toutes les valeurs portant une confidence.
  const confs = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (typeof o.confidence === "number") confs.push(o.confidence);
    for (const v of Object.values(o)) if (typeof v === "object") walk(v);
  };
  walk(doc);
  const globale = confs.length ? confs.reduce((s, c) => s + c, 0) / confs.length : null;

  return { lignes, globale, confs };
}

function printSummary(doc, match) {
  const { lignes, globale, confs } = completeness(doc);
  const titre = `${(match?.team_a ?? doc.match.team_a).toUpperCase()} - ${(match?.team_b ?? doc.match.team_b).toUpperCase()}`;
  console.log(`\n${titre}`);
  console.log("─".repeat(Math.max(40, titre.length)));
  for (const [ok, label] of lignes) console.log(`  ${ok ? "✓" : "✗"} ${label}`);
  if (globale != null) {
    console.log(`\n  Confiance globale : ${Math.round(globale * 100)} % (${confs.length} valeurs)`);
    const douteuses = [];
    const walkNamed = (o, name) => {
      if (!o || typeof o !== "object") return;
      // Une valeur absente est déjà signalée par sa ligne ✗ : ne pas la
      // répéter ici, cette liste ne sert qu'aux valeurs PRÉSENTES mais douteuses.
      const valeur = o.player_name ?? o.name ?? o.value;
      if (typeof o.confidence === "number" && o.confidence < 0.9 && valeur != null) {
        douteuses.push(`${valeur} (${Math.round(o.confidence * 100)} %)`);
      }
      for (const [k, v] of Object.entries(o)) if (typeof v === "object") walkNamed(v, k);
    };
    walkNamed(doc, "racine");
    if (douteuses.length) console.log(`  ⚠ à revérifier : ${douteuses.join(", ")}`);
  }
}

// ── Import d'un document ─────────────────────────────────────────────────────
async function importDoc(doc, file) {
  const { data: match, error } = await sb
    .from("matches")
    .select("id, team_a, team_b, phase, score_a, score_b, referee")
    .eq("id", doc.match.id)
    .single();
  if (error) throw new Error(`match ${doc.match.id} introuvable (${file}) : ${error.message}`);

  // Garde-fou : le JSON doit décrire le match qu'il prétend décrire.
  if (match.team_a !== doc.match.team_a || match.team_b !== doc.match.team_b) {
    throw new Error(
      `${file} : incohérence d'équipes. Base = ${match.team_a} vs ${match.team_b}, ` +
      `JSON = ${doc.match.team_a} vs ${doc.match.team_b}. Vérifie l'ordre domicile/extérieur.`
    );
  }

  printSummary(doc, match);

  const lineupRows = [];
  const statRows = [];
  const aliasRows = [];

  for (const p of doc.lineups ?? []) {
    const side = SIDE[p.team_side];
    lineupRows.push({
      match_id: match.id,
      team_side: side,
      player_name: p.player_name,
      shirt_number: p.number ?? null,
      is_starting: p.started !== false,
      role: doc.formations?.[p.team_side]?.value ?? null,
      player_id: null, // jamais deviné — cf. player_aliases
    });
    statRows.push({
      match_id: match.id,
      team_side: side,
      player_name: p.player_name,
      player_id: null,
      rating: p.rating ?? null,
      // Le buteur est nommé en entier dans l'en-tête ("Kylian Mbappé") et
      // abrégé dans le onze ("K. Mbappé"). On n'apparie JAMAIS par
      // ressemblance : le JSON porte un lien explicite `lineup_player_name`,
      // null quand le buteur est entré en cours de jeu. Sans ce lien, le
      // rapprochement échouerait en silence — et « L. Martínez » (Lisandro,
      // défenseur) se verrait créditer du but de Lautaro Martínez.
      goals: (doc.events ?? []).filter(
        (e) => e.lineup_player_name === p.player_name && (e.type === "goal" || e.type === "penalty")
      ).length,
      assists: (doc.events ?? []).filter(
        (e) => e.lineup_assist_name === p.player_name
      ).length + (p.assists ?? 0),
      yellow_cards: p.yellow_cards ?? 0,
      red_cards: p.red_cards ?? 0,
      started: p.started !== false,
      is_motm: doc.motm?.player_name === p.player_name && doc.motm?.team_side === p.team_side,
      source: "sofascore",
    });
    aliasRows.push({
      provider: doc.source?.provider ?? "sofascore",
      alias: p.player_name,
      canonical_player_id: null,
      canonical_name: null,
      confidence: 0, // 0 = non rattaché. Passe à 1.0 une fois validé humainement.
      first_seen_match_id: match.id,
      source_image: doc.source?.image ?? null,
      validated_at: null,
    });
  }

  // Les buteurs entrés en cours de jeu n'ont pas de ligne de composition : sans
  // ça, ils n'auraient aucun alias — alors que ce sont les noms les plus
  // ambigus du lot (« Lautaro Martínez » vs « L. Martínez » du onze).
  for (const e of doc.events ?? []) {
    if (!e.player_name || e.lineup_player_name) continue;
    if (aliasRows.some((a) => a.alias === e.player_name)) continue;
    aliasRows.push({
      provider: doc.source?.provider ?? "sofascore",
      alias: e.player_name,
      canonical_player_id: null,
      canonical_name: null,
      confidence: 0,
      first_seen_match_id: match.id,
      source_image: doc.source?.image ?? null,
      validated_at: null,
    });
  }

  const eventRows = (doc.events ?? []).map((e) => ({
    match_id: match.id,
    team_side: e.team_side,
    player_name: e.player_name,
    type: e.type,
    detail: e.detail ?? null,
    minute: e.minute ?? null,
    extra_minute: e.extra_minute ?? null,
  }));

  console.log(
    `\n  → ${lineupRows.length} compos, ${statRows.length} notes, ${eventRows.length} événement(s), ` +
    `${aliasRows.length} alias` + (doc.referee?.name && !match.referee ? ", arbitre" : "")
  );

  if (!APPLY) return { lineupRows, statRows, eventRows, aliasRows };

  // Snapshot de l'existant AVANT écriture.
  const dir = path.join(ROOT, "scripts", "snapshots");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const before = {};
  for (const t of ["match_events", "match_lineups", "player_match_stats"]) {
    const { data } = await sb.from(t).select("*").eq("match_id", match.id);
    before[t] = data ?? [];
  }
  const snap = path.join(dir, `import-${path.parse(file).name}-${stamp}.json`);
  fs.writeFileSync(snap, JSON.stringify({ match, before }, null, 2));
  console.log(`  snapshot : ${path.relative(ROOT, snap)}`);

  // Compos et notes : on remplace intégralement le lot de ce match. Les lignes
  // existantes viennent d'estimations IA (source 'gemini') ou d'une synchro
  // partielle — les vraies notes font autorité.
  await sb.from("match_lineups").delete().eq("match_id", match.id);
  const { error: eL } = await sb.from("match_lineups").insert(lineupRows);
  if (eL) throw eL;

  await sb.from("player_match_stats").delete().eq("match_id", match.id);
  const { error: eS } = await sb.from("player_match_stats").insert(statRows);
  if (eS) throw eS;

  // Événements : on ne réinsère que ceux qui manquent (une synchro partielle a
  // pu en poser de corrects — on évite le doublon plutôt que de tout raser).
  const { data: existing } = await sb
    .from("match_events")
    .select("type, minute, player_name")
    .eq("match_id", match.id);
  const key = (e) => `${e.type}|${e.minute}|${e.player_name}`;
  const seen = new Set((existing ?? []).map(key));
  const nouveaux = eventRows.filter((e) => !seen.has(key(e)));
  if (nouveaux.length) {
    const { error: eE } = await sb.from("match_events").insert(nouveaux);
    if (eE) throw eE;
  }
  console.log(`  événements : ${nouveaux.length} ajouté(s), ${eventRows.length - nouveaux.length} déjà présent(s)`);

  // Arbitre : on ne réécrit pas une valeur déjà renseignée.
  const patch = { data_origin: "reconstructed" };
  if (doc.referee?.name && !match.referee) patch.referee = doc.referee.name;
  const { error: eM } = await sb.from("matches").update(patch).eq("id", match.id);
  if (eM && !/data_origin/.test(eM.message)) throw eM;
  if (eM) console.log("  ⚠ colonne data_origin absente — migration non appliquée, on continue sans");

  // Alias : jamais écrasés (un rattachement validé doit survivre à un réimport).
  const { error: eA } = await sb
    .from("player_aliases")
    .upsert(aliasRows, { onConflict: "provider,alias", ignoreDuplicates: true });
  if (eA) console.log(`  ⚠ player_aliases indisponible (${eA.message}) — migration non appliquée, alias non enregistrés`);
  else console.log(`  alias : ${aliasRows.length} enregistré(s) (non rattachés)`);

  console.log("  ✅ importé");
  return { lineupRows, statRows, eventRows, aliasRows };
}

(async () => {
  console.log(APPLY ? "=== IMPORT (écriture) ===" : "=== DRY-RUN (aucune écriture) ===");

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`✗ ${path.relative(ROOT, DATA_DIR)} introuvable.`);
    process.exit(1);
  }
  const files = TARGET
    ? [path.basename(TARGET)]
    : fs.readdirSync(DATA_DIR).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) {
    console.error("✗ aucun fichier JSON à importer.");
    process.exit(1);
  }

  for (const f of files) {
    const doc = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
    await importDoc(doc, f);
  }

  if (!APPLY) console.log("\n(dry-run — relance avec --apply pour écrire)");
})().catch((e) => {
  console.error("\n✗", e.message);
  process.exit(1);
});
