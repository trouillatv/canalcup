// Lecture seule : compte les quiz_questions en base et donne un diagnostic
// « prêt pour le 15 ? » — total, répartition catégorie/difficulté, distribution
// des bonnes réponses, doublons de question. N'écrit RIEN.
//   node scripts/quiz-count.js
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
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");

(async () => {
  const { data: qs, error } = await sb
    .from("quiz_questions")
    .select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, difficulty, category, created_at");
  if (error) { console.error("Erreur:", error.message); process.exit(1); }

  const byCat = {}, byDiff = {}, byCorrect = { A: 0, B: 0, C: 0, D: 0 };
  const seen = new Map();
  const dups = [];
  let missing = 0;
  for (const q of qs) {
    byCat[q.category] = (byCat[q.category] || 0) + 1;
    byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    if (byCorrect[q.correct_answer] !== undefined) byCorrect[q.correct_answer]++;
    if (!q.answer_a || !q.answer_b || !q.answer_c || !q.answer_d || !q.correct_answer) missing++;
    const key = norm(q.question);
    if (seen.has(key)) dups.push(q.question.slice(0, 60));
    else seen.set(key, true);
  }

  console.log(`\n=== QUIZ — ÉTAT EN BASE ===\n`);
  console.log(`TOTAL questions : ${qs.length}`);
  console.log(`\nPar catégorie :`, byCat);
  console.log(`Par difficulté :`, byDiff);
  console.log(`Distribution bonne réponse :`, byCorrect);
  const pct = (n) => `${Math.round((n / qs.length) * 100)}%`;
  console.log(`  → A ${pct(byCorrect.A)} · B ${pct(byCorrect.B)} · C ${pct(byCorrect.C)} · D ${pct(byCorrect.D)}`);
  console.log(`\nQuestions incomplètes (option/réponse manquante) : ${missing}`);
  console.log(`Doublons de question : ${dups.length}`);
  for (const d of dups.slice(0, 20)) console.log(`   • ${d}`);
})();
