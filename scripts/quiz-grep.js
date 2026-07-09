// Lecture seule : cherche dans quiz_questions (BASE) des questions contenant un
// motif (regex, insensible casse/accents). Usage :
//   node scripts/quiz-grep.js "femme|épouse|compagne|wag|petite amie"
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
const strip = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

(async () => {
  const pattern = process.argv[2] || "femme|epouse|compagne|wag|petite amie|petite-amie|mari |conjoint";
  const re = new RegExp(strip(pattern), "i");
  const { data: qs } = await sb
    .from("quiz_questions")
    .select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, category");
  const hits = [];
  for (const q of qs) {
    const hay = strip([q.question, q.answer_a, q.answer_b, q.answer_c, q.answer_d].join(" | "));
    if (re.test(hay)) hits.push(q);
  }
  console.log(`\nMotif : /${pattern}/i`);
  console.log(`Correspondances en BASE : ${hits.length} / ${qs.length}\n`);
  for (const q of hits) {
    console.log(`• [${q.category}] ${q.question}`);
    console.log(`    A:${q.answer_a} | B:${q.answer_b} | C:${q.answer_c} | D:${q.answer_d}  (bonne=${q.correct_answer})`);
  }
})();
