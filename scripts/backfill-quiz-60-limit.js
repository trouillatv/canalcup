// Recalcule les points_awarded des réponses SOLO selon le plafond de scoring
// « 60 questions PAR quiz » (voir lib/quiz/counted.ts). Corrige les réponses Solo
// du 2e quiz remises à 0 par l'ancien budget global.
//
//   node scripts/backfill-quiz-60-limit.js            # DRY-RUN (aucune écriture)
//   node scripts/backfill-quiz-60-limit.js --apply    # écrit réellement
//
// Le dry-run affiche : nb de réponses Solo, nb concernées, et par joueur le
// total Solo AVANT → APRÈS. Idempotence : après un --apply, un nouveau run (dry
// ou apply) doit rapporter 0 changement.

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envPath = ".env.local";
const envText = fs.readFileSync(envPath, "utf8");
for (const line of envText.split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!match) continue;
  let value = match[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  process.env[match[1]] = value;
}

const APPLY = process.argv.includes("--apply");
const LIMIT = 60;
const FAST_THRESHOLD_MS = 7000;

function scoreRow(answer) {
  const isCorrect = !!answer.is_correct && (answer.answer ?? "") !== "";
  if (!isCorrect) return 0;
  return (Number(answer.response_time_ms) || 0) <= FAST_THRESHOLD_MS ? 5 : 3;
}

// Plafond de 60 questions DISTINCTES PAR QUIZ (pas un budget global partagé) : le
// championnat cumule les 2 quiz, chacun comptant ses 60 premières questions.
// Aligné sur countedQuestionIdsFromSessions (lib/quiz/counted.ts).
function countedQuestionIds(sessions) {
  const counted = new Set();
  for (const session of sessions ?? []) {
    const ids = Array.isArray(session.question_ids) ? session.question_ids : [];
    const distinct = [...new Set(ids)].slice(0, LIMIT);
    for (const id of distinct) counted.add(id);
  }
  return counted;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials in .env.local");
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: sessions, error: sessionsError } = await sb
    .from("quiz_session")
    .select("id, created_at, question_ids");
  if (sessionsError) throw sessionsError;

  const answers = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("quiz_answers")
      .select("id, user_id, quiz_session_id, question_id, points_awarded, mode, answer, is_correct, response_time_ms")
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    answers.push(...data);
    if (data.length < 1000) break;
  }

  const countedIds = countedQuestionIds(sessions);

  const soloAnswers = (answers ?? []).filter((a) => String(a.mode || "") === "solo");
  const changes = [];
  // Par joueur : total Solo AVANT (stocké) et APRÈS (recalculé) — pour l'audit.
  const perUser = new Map(); // user_id -> { before, after }
  for (const a of soloAnswers) {
    const before = a.points_awarded ?? 0;
    const after = countedIds.has(a.question_id) ? scoreRow(a) : 0;
    const u = perUser.get(a.user_id) ?? { before: 0, after: 0 };
    u.before += before;
    u.after += after;
    perUser.set(a.user_id, u);
    if (before !== after) changes.push({ id: a.id, user_id: a.user_id, before, after });
  }

  // Noms d'affichage pour un rapport lisible.
  const affectedUserIds = [...new Set(changes.map((c) => c.user_id))];
  const nameById = new Map();
  if (affectedUserIds.length) {
    const { data: users } = await sb
      .from("users")
      .select("id, display_name, name")
      .in("id", affectedUserIds);
    for (const u of users ?? []) {
      nameById.set(u.id, (u.display_name && u.display_name.trim()) || (u.name && u.name.trim()) || "Joueur");
    }
  }

  console.log(`Mode            : ${APPLY ? "APPLY (écriture réelle)" : "DRY-RUN (aucune écriture)"}`);
  console.log(`Sessions        : ${sessions?.length ?? 0}`);
  console.log(`Questions comptées (union par-quiz) : ${countedIds.size}`);
  console.log(`Réponses totales: ${answers?.length ?? 0}`);
  console.log(`Réponses Solo   : ${soloAnswers.length}`);
  console.log(`Lignes Solo modifiées : ${changes.length}`);

  const affected = affectedUserIds
    .map((uid) => {
      const u = perUser.get(uid);
      return { name: nameById.get(uid) ?? uid, before: u.before, after: u.after, delta: u.after - u.before };
    })
    .sort((a, b) => b.delta - a.delta);

  if (affected.length) {
    console.log("\nTotal Solo par joueur concerné (AVANT → APRÈS, Δ) :");
    for (const p of affected) {
      const sign = p.delta >= 0 ? "+" : "";
      console.log(`  ${p.name.padEnd(24)} ${String(p.before).padStart(5)} → ${String(p.after).padStart(5)}  (${sign}${p.delta})`);
    }
  } else {
    console.log("\nAucun joueur concerné — rien à modifier (idempotent).");
  }

  if (!APPLY) {
    console.log("\nDRY-RUN terminé. Relancer avec --apply pour écrire ces changements.");
    return;
  }

  let updated = 0;
  const errors = [];
  // Séquentiel par lots pour ne pas saturer PostgREST, et pour un compte fiable.
  for (const c of changes) {
    const { error } = await sb.from("quiz_answers").update({ points_awarded: c.after }).eq("id", c.id);
    if (error) errors.push(error);
    else updated += 1;
  }
  if (errors.length) throw new Error(errors[0].message);
  console.log(`\nAPPLY terminé. Lignes écrites : ${updated}. Relancer sans --apply pour vérifier l'idempotence (doit afficher 0).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
