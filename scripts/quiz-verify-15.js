// Lecture seule : vérifie l'état pour le Quiz du 15 après désactivation WAG.
//   node scripts/quiz-verify-15.js
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
async function selectAll(table, cols) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from(table).select(cols).range(from, from + 999);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}
(async () => {
  const [all, sessions, answers] = await Promise.all([
    selectAll("quiz_questions", "id, disabled"),
    selectAll("quiz_session", "question_ids"),
    selectAll("quiz_answers", "question_id"),
  ]);
  const disabled = all.filter((q) => q.disabled).length;
  const active = all.filter((q) => !q.disabled);
  const consumed = new Set();
  for (const s of sessions) if (Array.isArray(s.question_ids)) for (const id of s.question_ids) consumed.add(id);
  for (const a of answers) consumed.add(a.question_id);
  const pool = active.filter((q) => !consumed.has(q.id)).length;

  console.log(`\n=== VÉRIF QUIZ DU 15 ===`);
  console.log(`Total en base            : ${all.length}`);
  console.log(`Désactivées (WAG blagues): ${disabled}`);
  console.log(`Actives                  : ${active.length}`);
  console.log(`Pool réel du prochain Live (actives − déjà consommées) : ${pool}`);
  console.log(pool >= 60
    ? `✅ ${pool} questions neuves & actives disponibles pour le tirage de 60. Aucune blague WAG possible.`
    : `⚠️ Seulement ${pool} questions disponibles (< 60).`);
})();
