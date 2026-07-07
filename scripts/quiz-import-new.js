// Import des NOUVELLES questions quiz depuis public/Quiz/Quiz.txt.
//   - N'insère QUE les questions absentes de la base (match par texte normalisé).
//   - Ne TOUCHE PAS aux questions existantes (pas de re-shuffle).
//   - Anti-fuite : retire une parenthèse finale « (… chiffre …) » (buts/titres/années).
//   - SHUFFLE les 4 réponses de chaque nouvelle question (la bonne n'est plus en A).
//
//   node scripts/quiz-import-new.js --dry   → simulation (n'écrit rien)
//   node scripts/quiz-import-new.js         → applique
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
const DRY = process.argv.includes("--dry");
const KEYS = ["A", "B", "C", "D"];

function parseCsvLine(line) {
  const out = []; let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') inQ = false; else cur += c; }
    else { if (c === '"') inQ = true; else if (c === ";") { out.push(cur); cur = ""; } else cur += c; }
  }
  out.push(cur); return out;
}
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const strip = (s) => (s || "").replace(/\s*\((?=[^)]*\d)[^)]*\)\s*$/, "").trim();

function shuffleOpts(opts, correctIdx) {
  const arr = opts.map((text, i) => ({ text, wasCorrect: i === correctIdx }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { texts: arr.map((x) => x.text), correct: KEYS[arr.findIndex((x) => x.wasCorrect)] };
}

(async () => {
  const raw = fs.readFileSync(path.join(__dirname, "../public/Quiz/Quiz.txt"), "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length); lines.shift();
  const fileQs = [];
  for (const line of lines) {
    const c = parseCsvLine(line);
    if (c.length < 7) continue;
    fileQs.push({
      question: (c[1] || "").trim(),
      opts: [(c[2] || "").trim(), (c[3] || "").trim(), (c[4] || "").trim(), (c[5] || "").trim()],
      correct: (c[6] || "").trim().toUpperCase(),
      expl: (c[7] || "").trim(),
    });
  }

  const { data: dbQs } = await sb.from("quiz_questions").select("id, question");
  const dbNorms = new Set((dbQs ?? []).map((q) => norm(q.question)));

  let inserted = 0, skipped = 0, badCorrect = 0, leaks = 0;
  const finalDist = { A: 0, B: 0, C: 0, D: 0 };
  const seenInFile = new Set();
  const toInsert = [];

  for (const q of fileQs) {
    const key = norm(q.question);
    if (!key) continue;
    if (dbNorms.has(key) || seenInFile.has(key)) { skipped++; continue; }
    seenInFile.add(key);
    const correctIdx = KEYS.indexOf(q.correct);
    if (correctIdx < 0) { badCorrect++; continue; } // réponse correcte invalide → on saute
    const opts1 = q.opts.map(strip);
    if (opts1.some((o, i) => o !== q.opts[i])) leaks++;
    const { texts, correct } = shuffleOpts(opts1, correctIdx);
    finalDist[correct]++;
    inserted++;
    toInsert.push({
      question: q.question,
      answer_a: texts[0], answer_b: texts[1], answer_c: texts[2], answer_d: texts[3],
      correct_answer: correct, explanation: q.expl || null,
      category: "foot", difficulty: "medium",
    });
  }

  if (!DRY && toInsert.length) {
    // Insertion par lots de 100.
    for (let i = 0; i < toInsert.length; i += 100) {
      const { error } = await sb.from("quiz_questions").insert(toInsert.slice(i, i + 100));
      if (error) { console.error("Erreur insert:", error.message); process.exit(1); }
    }
  }

  console.log(`${DRY ? "[DRY] " : ""}Fichier: ${fileQs.length} questions · déjà en base/doublons ignorés: ${skipped}`);
  console.log(`${DRY ? "[DRY] " : ""}Nouvelles importées: ${inserted}`);
  console.log(`${DRY ? "[DRY] " : ""}Parenthèses numériques retirées (anti-fuite): ${leaks} · réponses correctes invalides ignorées: ${badCorrect}`);
  console.log(`${DRY ? "[DRY] " : ""}Distribution des bonnes réponses (nouvelles) APRÈS shuffle:`, finalDist);
  const { count } = DRY ? { count: null } : await sb.from("quiz_questions").select("id", { count: "exact", head: true });
  if (!DRY) console.log(`Total en base après import: ${count}`);
})();
