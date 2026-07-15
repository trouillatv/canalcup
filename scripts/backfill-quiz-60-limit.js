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

const LIMIT = 60;
const FAST_THRESHOLD_MS = 7000;

function scoreRow(answer) {
  const isCorrect = !!answer.is_correct && (answer.answer ?? "") !== "";
  if (!isCorrect) return 0;
  return (Number(answer.response_time_ms) || 0) <= FAST_THRESHOLD_MS ? 5 : 3;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase credentials in .env.local");
  }

  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const [{ data: sessions, error: sessionsError }] = await Promise.all([
    sb.from("quiz_session").select("id, created_at, question_ids"),
  ]);
  if (sessionsError) throw sessionsError;

  const answers = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("quiz_answers")
      .select("id, quiz_session_id, question_id, points_awarded, mode, answer, is_correct, response_time_ms")
      .range(from, from + 999);
    if (error) throw error;
    if (!data || data.length === 0) break;
    answers.push(...data);
    if (data.length < 1000) break;
  }

  const countedIds = new Set();
  const orderedSessions = [...(sessions ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  for (const session of orderedSessions) {
    const ids = Array.isArray(session.question_ids) ? session.question_ids : [];
    for (const id of ids) {
      if (countedIds.size >= LIMIT) break;
      countedIds.add(id);
    }
    if (countedIds.size >= LIMIT) break;
  }

  const updates = [];
  for (const answer of answers ?? []) {
    const mode = String(answer.mode || "");
    if (mode !== "solo") continue;
    const nextPoints = countedIds.has(answer.question_id) ? scoreRow(answer) : 0;
    if ((answer.points_awarded ?? 0) !== nextPoints) {
      updates.push(
        sb.from("quiz_answers").update({ points_awarded: nextPoints }).eq("id", answer.id)
      );
    }
  }

  const results = await Promise.all(updates);
  const errors = results.filter((r) => r.error);
  if (errors.length) {
    throw new Error(errors[0].error.message);
  }

  console.log(JSON.stringify({
    sessions: sessions?.length ?? 0,
    answers: answers?.length ?? 0,
    updated: updates.length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
