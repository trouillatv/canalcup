// Analyse À BLANC (lecture seule) : parse public/Quizz/Quizz.txt, lit les
// quiz_questions en base, repère doublons + FUITES de réponse (la bonne réponse
// devinable depuis la question ou une option). N'écrit RIEN.
//   node scripts/quiz-analyze.js
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

// ── Parse CSV ';' avec champs éventuellement entre guillemets ────────────────
function parseCsvLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ";") { out.push(cur); cur = ""; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

(async () => {
  const raw = fs.readFileSync(path.join(__dirname, "../public/Quizz/Quizz.txt"), "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length);
  const header = lines.shift();
  const fileQs = [];
  for (const line of lines) {
    const c = parseCsvLine(line);
    if (c.length < 7) continue;
    const [num, question, a, b, cc, d, correct, expl] = c;
    fileQs.push({ num: num.trim(), question: question.trim(), A: a.trim(), B: b.trim(), C: cc.trim(), D: d.trim(), correct: (correct || "").trim().toUpperCase(), expl: (expl || "").trim() });
  }

  // Base
  const { data: dbQs } = await sb.from("quiz_questions").select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer");
  const dbByNorm = new Map((dbQs ?? []).map((q) => [norm(q.question), q]));

  // ── 1. Doublons fichier vs base ────────────────────────────────────────────
  let dup = 0, nouveaux = 0;
  for (const q of fileQs) { if (dbByNorm.has(norm(q.question))) dup++; else nouveaux++; }

  // ── 2. Distribution des bonnes réponses (fichier) ──────────────────────────
  const distFile = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of fileQs) if (distFile[q.correct] !== undefined) distFile[q.correct]++;
  const distDb = { A: 0, B: 0, C: 0, D: 0 };
  for (const q of dbQs ?? []) if (distDb[q.correct_answer] !== undefined) distDb[q.correct_answer]++;

  // ── 3. FUITES de réponse ───────────────────────────────────────────────────
  // a) la bonne réponse (texte) apparait dans la question
  // b) une option contient des parenthèses (info « en trop », ex. « (16 buts) »)
  //    surtout si SEULE la bonne option en a → indice.
  // c) une option est bien plus longue que les autres (format different).
  const leaks = [];
  const scan = (src, q) => {
    const opts = { A: q.A ?? q.answer_a, B: q.B ?? q.answer_b, C: q.C ?? q.answer_c, D: q.D ?? q.answer_d };
    const correct = q.correct ?? q.correct_answer;
    const question = q.question;
    const flags = [];
    // a) réponse dans la question
    const cTxt = opts[correct] || "";
    if (cTxt && cTxt.length >= 4 && norm(question).includes(norm(cTxt))) flags.push(`réponse « ${cTxt} » dans la question`);
    // b) parenthèses
    const withParen = Object.entries(opts).filter(([, v]) => /\([^)]*\d[^)]*\)|\([^)]{3,}\)/.test(v || ""));
    if (withParen.length) {
      const onlyCorrect = withParen.length === 1 && withParen[0][0] === correct;
      flags.push(`parenthèses sur ${withParen.map(([k]) => k).join(",")}${onlyCorrect ? " (UNIQUEMENT la bonne → gros indice)" : ""}`);
    }
    // c) longueur atypique de la bonne option
    const lens = Object.values(opts).map((v) => (v || "").length);
    const cLen = (cTxt || "").length;
    const others = Object.entries(opts).filter(([k]) => k !== correct).map(([, v]) => (v || "").length);
    const avgOther = others.reduce((a, b) => a + b, 0) / Math.max(1, others.length);
    if (cLen > 0 && avgOther > 0 && cLen > avgOther * 2.2 && cLen - avgOther > 15) flags.push(`bonne option 2x+ plus longue`);
    void lens;
    if (flags.length) leaks.push({ src, ref: q.num ?? q.id, question: question.slice(0, 70), correct, flags });
  };
  for (const q of fileQs) scan("FICHIER", q);
  for (const q of dbQs ?? []) scan("BASE", q);

  // ── Rapport ────────────────────────────────────────────────────────────────
  console.log(`FICHIER : ${fileQs.length} questions`);
  console.log(`BASE    : ${(dbQs ?? []).length} questions`);
  console.log(`Doublons fichier↔base : ${dup} · Nouvelles à importer : ${nouveaux}`);
  console.log(`Distribution bonnes réponses FICHIER :`, distFile);
  console.log(`Distribution bonnes réponses BASE    :`, distDb);
  console.log(`\n⚠️  FUITES POTENTIELLES : ${leaks.length}\n`);
  const optsOf = (q) => ({ A: q.A ?? q.answer_a, B: q.B ?? q.answer_b, C: q.C ?? q.answer_c, D: q.D ?? q.answer_d });
  const fileByNum = new Map(fileQs.map((q) => [q.num, q]));
  const dbById = new Map((dbQs ?? []).map((q) => [q.id, q]));
  for (const l of leaks) {
    const q = l.src === "FICHIER" ? fileByNum.get(l.ref) : dbById.get(l.ref);
    const o = optsOf(q);
    console.log(`[${l.src} ${l.ref}] bonne=${l.correct} | ${l.flags.join(" ; ")}`);
    console.log(`   Q: ${q.question}`);
    for (const k of ["A", "B", "C", "D"]) console.log(`   ${k === l.correct ? "✓" : " "}${k}: ${o[k]}`);
    console.log("");
  }
})();
