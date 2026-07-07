// Import + anti-fuite + shuffle des réponses du quiz.
//   1. Retire les parenthèses en FIN d'option (ex. « Brésil (5 titres) » → « Brésil »)
//      → supprime les fuites numériques (buts/titres/années) sur toutes les questions.
//   2. Importe les questions de public/Quizz/Quizz.txt absentes de la base.
//   3. SHUFFLE les 4 réponses de CHAQUE question (base + nouvelles) → la bonne
//      réponse n'est plus toujours en A.
//
//   node scripts/quiz-import-shuffle.js --dry   → simulation (n'écrit rien)
//   node scripts/quiz-import-shuffle.js         → applique
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
// Retire une parenthèse finale « … (xxx) » UNIQUEMENT si elle contient un chiffre
// (ex. « Brésil (5 titres) », « Klose (16 buts) », « Pelé (17 ans…) ») → supprime
// les fuites numériques SANS toucher aux chutes humoristiques (sans chiffre).
const strip = (s) => (s || "").replace(/\s*\((?=[^)]*\d)[^)]*\)\s*$/, "").trim();

// Shuffle Fisher-Yates d'un tableau [textes A,B,C,D] + suit l'index de la bonne.
function shuffleOpts(opts, correctIdx) {
  const arr = opts.map((text, i) => ({ text, wasCorrect: i === correctIdx }));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { texts: arr.map((x) => x.text), correct: KEYS[arr.findIndex((x) => x.wasCorrect)] };
}

(async () => {
  // ── Parse fichier ──
  const raw = fs.readFileSync(path.join(__dirname, "../public/Quizz/Quizz.txt"), "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length); lines.shift();
  const fileQs = [];
  for (const line of lines) {
    const c = parseCsvLine(line);
    if (c.length < 7) continue;
    fileQs.push({
      question: c[1].trim(),
      opts: [c[2].trim(), c[3].trim(), c[4].trim(), c[5].trim()],
      correct: (c[6] || "").trim().toUpperCase(),
      expl: (c[7] || "").trim(),
    });
  }

  const { data: dbQs } = await sb.from("quiz_questions").select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer");
  const dbNorms = new Set((dbQs ?? []).map((q) => norm(q.question)));

  let stripped = 0, updated = 0, inserted = 0, skipped = 0;
  const finalDist = { A: 0, B: 0, C: 0, D: 0 };

  // ── 1+3. Nettoie + shuffle les questions EN BASE (UPDATE) ──
  for (const q of dbQs ?? []) {
    const opts0 = [q.answer_a, q.answer_b, q.answer_c, q.answer_d];
    const opts1 = opts0.map(strip);
    stripped += opts0.filter((o, i) => o !== opts1[i]).length;
    const correctIdx = KEYS.indexOf(q.correct_answer);
    const { texts, correct } = shuffleOpts(opts1, correctIdx < 0 ? 0 : correctIdx);
    finalDist[correct]++;
    updated++;
    if (!DRY) {
      await sb.from("quiz_questions").update({
        answer_a: texts[0], answer_b: texts[1], answer_c: texts[2], answer_d: texts[3], correct_answer: correct,
      }).eq("id", q.id);
    }
  }

  // ── 2+1+3. Importe les nouvelles (nettoie + shuffle) ──
  for (const q of fileQs) {
    if (dbNorms.has(norm(q.question))) { skipped++; continue; }
    const opts1 = q.opts.map(strip);
    const correctIdx = KEYS.indexOf(q.correct);
    const { texts, correct } = shuffleOpts(opts1, correctIdx < 0 ? 0 : correctIdx);
    finalDist[correct]++;
    inserted++;
    if (!DRY) {
      await sb.from("quiz_questions").insert({
        question: q.question,
        answer_a: texts[0], answer_b: texts[1], answer_c: texts[2], answer_d: texts[3],
        correct_answer: correct, explanation: q.expl || null,
        category: "foot", difficulty: "medium",
      });
    }
  }

  console.log(`${DRY ? "[DRY] " : ""}Base mise à jour (nettoyée + shufflée) : ${updated}`);
  console.log(`${DRY ? "[DRY] " : ""}Nouvelles importées                  : ${inserted} (doublons ignorés : ${skipped})`);
  console.log(`${DRY ? "[DRY] " : ""}Parenthèses finales retirées         : ${stripped}`);
  console.log(`${DRY ? "[DRY] " : ""}Distribution des bonnes réponses APRÈS shuffle :`, finalDist,
    `→ total ${updated + inserted}`);
})();
