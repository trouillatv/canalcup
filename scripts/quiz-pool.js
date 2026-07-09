// Lecture seule : combien de questions restent VRAIMENT neuves pour un Live —
// en excluant À LA FOIS les questions déjà projetées en Live (session.question_ids)
// ET les questions déjà répondues (quiz_answers, tous modes = Live + Solo).
// N'écrit RIEN.   node scripts/quiz-pool.js
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
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

(async () => {
  const [qs, sessions, answers] = await Promise.all([
    selectAll("quiz_questions", "id"),
    selectAll("quiz_session", "id, question_ids, status, ended_at, created_at"),
    selectAll("quiz_answers", "question_id, mode"),
  ]);
  const total = qs.length;

  const liveSet = new Set();           // questions projetées en Live (session.question_ids)
  for (const s of sessions) if (Array.isArray(s.question_ids)) for (const id of s.question_ids) liveSet.add(id);

  const answeredAll = new Set();       // questions répondues (tous modes)
  const answeredSolo = new Set();
  const answeredLive = new Set();
  for (const a of answers) {
    answeredAll.add(a.question_id);
    if (a.mode === "solo") answeredSolo.add(a.question_id);
    else answeredLive.add(a.question_id);
  }

  const consumed = new Set([...liveSet, ...answeredAll]); // ce que le Live DEVRAIT exclure
  const availableStrict = total - consumed.size;
  const availableTodayLogic = total - liveSet.size;       // ce que le code exclut AUJOURD'HUI

  console.log(`\n=== POOL QUIZ ===`);
  console.log(`Total en base                         : ${total}`);
  console.log(`Projetées en Live (session.ids)       : ${liveSet.size}`);
  console.log(`Répondues (tous modes)                : ${answeredAll.size}  [solo ${answeredSolo.size} · live ${answeredLive.size}]`);
  console.log(`\n-- Exclusion ACTUELLE du code (Live question_ids uniquement) --`);
  console.log(`  Disponibles                         : ${availableTodayLogic}`);
  const soloOnly = [...answeredSolo].filter((id) => !liveSet.has(id)).length;
  console.log(`  ⚠️ dont ${soloOnly} déjà vues en SOLO mais RÉ-ÉLIGIBLES au prochain Live`);
  console.log(`\n-- Exclusion CORRIGÉE (Live ∪ toutes réponses) --`);
  console.log(`  Réellement neuves                    : ${availableStrict}`);
  console.log(availableStrict >= 60
    ? `  ✅ Assez de questions 100% neuves pour le 15 (${availableStrict} ≥ 60).`
    : `  ⚠️ Moins de 60 questions 100% neuves (${availableStrict}).`);
})();
