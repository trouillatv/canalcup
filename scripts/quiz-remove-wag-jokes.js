// Retire de quiz_questions les BLAGUES à stéréotypes sur les « femmes de
// footballeur » (WAGs). GARDE les questions factuelles (arbitres femmes,
// mariages réels). Réversible : sauvegarde les lignes retirées dans un backup.
//
//   node scripts/quiz-remove-wag-jokes.js            → SIMULATION (n'écrit rien)
//   node scripts/quiz-remove-wag-jokes.js --commit   → sauvegarde + supprime
//
// Sécurité clé étrangère : une question déjà RÉPONDUE (quiz_answers) ne peut pas
// être supprimée sans corrompre les scores → on la laisse (elle est de toute façon
// déjà exclue des futurs tirages par consumedQuestionIds) et on la SIGNALE.
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

// Empreintes distinctives des 13 blagues à retirer (une par question).
const JOKE_MARKERS = [
  "mercato d'hiver",
  "oublie l'anniversaire de sa femme",
  "rate un penalty en finale, que fait sa femme",
  "point commun entre un joueur de football professionnel et son epouse",
  "plus difficile pour la femme d'un joueur transfere en angleterre",
  "difference entre une faute sifflee par un arbitre homme et une arbitre femme",
  "pire moment pour un footballeur professionnel lors d'une session shopping",
  "part en 'mise au vert'",
  "demande de passer l'aspirateur",
  "role crucial d'une wag pendant la coupe du monde",
  "regard noir de sa femme en tribune",
  "pire cauchemar d'une femme de joueur de football lors de la ceremonie du ballon d'or",
  "accessoire indispensable de la femme d'un joueur qui vient de signer dans un club en siberie",
].map(strip);

(async () => {
  const commit = process.argv.includes("--commit");
  const { data: qs } = await sb
    .from("quiz_questions")
    .select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, category, difficulty, explanation");

  const matched = qs.filter((q) => {
    const h = strip(q.question);
    return JOKE_MARKERS.some((m) => h.includes(m));
  });

  console.log(`\nQuestions blague ciblées : ${matched.length} (attendu 13)`);
  const unmatched = JOKE_MARKERS.filter((m) => !matched.some((q) => strip(q.question).includes(m)));
  if (unmatched.length) console.log(`⚠️ Empreintes sans correspondance : ${unmatched.length}\n   ${unmatched.join("\n   ")}`);

  // Compte des réponses par question ciblée (FK).
  const withAnswers = [];
  const deletable = [];
  for (const q of matched) {
    const { count } = await sb.from("quiz_answers").select("id", { count: "exact", head: true }).eq("question_id", q.id);
    (count > 0 ? withAnswers : deletable).push({ q, count: count ?? 0 });
  }

  console.log(`\nSupprimables (0 réponse)      : ${deletable.length}`);
  for (const { q } of deletable) console.log(`   • ${q.question.slice(0, 75)}`);
  console.log(`\nDéjà répondues (on N'EFFACE PAS) : ${withAnswers.length}`);
  for (const { q, count } of withAnswers) console.log(`   • (${count} rép.) ${q.question.slice(0, 65)}`);
  if (withAnswers.length) console.log(`   → déjà exclues des futurs tirages par consumedQuestionIds.`);

  if (!commit) {
    console.log(`\n[SIMULATION] Rien supprimé. Relance avec --commit pour appliquer.`);
    return;
  }

  // Backup AVANT suppression (réversible).
  const backup = path.join(__dirname, "backup-wag-jokes.json");
  fs.writeFileSync(backup, JSON.stringify(deletable.map((d) => d.q), null, 2), "utf8");
  console.log(`\n💾 Backup écrit : ${backup} (${deletable.length} questions)`);

  const ids = deletable.map((d) => d.q.id);
  if (ids.length) {
    const { error } = await sb.from("quiz_questions").delete().in("id", ids);
    if (error) { console.error("Erreur suppression:", error.message); process.exit(1); }
    console.log(`🗑️  Supprimées : ${ids.length}`);
  }
})();
