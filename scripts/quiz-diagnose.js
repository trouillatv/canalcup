// Diagnostic LECTURE SEULE du scoring quiz (aucune écriture en base).
//
//   node scripts/quiz-diagnose.js            # récap par quiz + anomalies
//   node scripts/quiz-diagnose.js "LaVARe"   # + détail question par question du joueur
//
// Répond à deux questions :
//  1) Pourquoi le Quiz #2 rapporte moins que le Quiz #1 ? → nb de questions par
//     quiz + score max atteignable.
//  2) Les « 0 point » sont-ils normaux (joueur absent / mauvaises réponses) ou
//     un bug ? → on FLAGGE les réponses CORRECTES payées 0 (le vrai symptôme
//     d'un bug de barème), et on distingue « 0 sans réponse » de « 0 malgré
//     des réponses ».

const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");

const envText = fs.readFileSync(".env.local", "utf8");
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  process.env[m[1]] = v;
}

const LIMIT = 60;
const FOCUS = process.argv[2]; // nom de joueur optionnel

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase credentials in .env.local");
  const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: sessionsRaw } = await sb.from("quiz_session").select("id, created_at, question_ids");
  const sessions = [...(sessionsRaw ?? [])].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );

  const answers = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("quiz_answers")
      .select("user_id, quiz_session_id, question_id, points_awarded, mode, answer, is_correct")
      .range(from, from + 999);
    if (!data || data.length === 0) break;
    answers.push(...data);
    if (data.length < 1000) break;
  }

  const userIds = [...new Set(answers.map((a) => a.user_id))];
  const nameById = new Map();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: us } = await sb.from("users").select("id, display_name, name").in("id", userIds.slice(i, i + 200));
    for (const u of us ?? []) nameById.set(u.id, (u.display_name?.trim() || u.name?.trim() || "Joueur"));
  }

  sessions.forEach((s, idx) => {
    const title = `Quiz #${idx + 1}`;
    const qids = [...new Set(Array.isArray(s.question_ids) ? s.question_ids : [])].slice(0, LIMIT);
    const qset = new Set(qids);
    const rows = answers.filter((a) => a.quiz_session_id === s.id);

    const perUser = new Map(); // uid -> {pts, ok, ans}
    let correctButZero = 0; // ⚠️ symptôme de bug : bonne réponse comptée, mais 0 point
    for (const a of rows) {
      const e = perUser.get(a.user_id) ?? { pts: 0, ok: 0, ans: 0 };
      e.pts += a.points_awarded ?? 0;
      e.ans += 1;
      if (a.is_correct) e.ok += 1;
      perUser.set(a.user_id, e);
      const counted = !a.question_id || qset.has(a.question_id);
      if (a.is_correct && (a.answer ?? "") !== "" && counted && (a.points_awarded ?? 0) === 0) correctButZero += 1;
    }
    const totals = [...perUser.values()];
    const pts = totals.map((t) => t.pts);
    const zeroNoAns = 0;
    const zeroWithAns = totals.filter((t) => t.pts === 0 && t.ans > 0).length;
    const maxTheoretical = qids.length * 5;
    const modes = [...new Set(rows.map((r) => String(r.mode || "?")))].join(", ");

    console.log(`\n=== ${title}  (${s.created_at}) ===`);
    console.log(`  Questions de la session   : ${qids.length}  → score max théorique ${maxTheoretical} pts`);
    console.log(`  Joueurs / réponses / modes: ${perUser.size} joueurs, ${rows.length} réponses [${modes}]`);
    console.log(`  Points  max / médiane     : ${pts.length ? Math.max(...pts) : 0} / ${median(pts)}`);
    console.log(`  Joueurs à 0 pt malgré ≥1 réponse : ${zeroWithAns}`);
    console.log(`  ⚠️ Réponses CORRECTES payées 0 (bug potentiel) : ${correctButZero}`);
  });

  if (FOCUS) {
    const uid = [...nameById.entries()].find(([, n]) => n.toLowerCase() === FOCUS.toLowerCase())?.[0]
      || [...nameById.entries()].find(([, n]) => n.toLowerCase().includes(FOCUS.toLowerCase()))?.[0];
    if (!uid) {
      console.log(`\nJoueur « ${FOCUS} » introuvable.`);
      return;
    }
    console.log(`\n\n### Détail pour ${nameById.get(uid)} ###`);
    sessions.forEach((s, idx) => {
      const rows = answers.filter((a) => a.quiz_session_id === s.id && a.user_id === uid);
      const pts = rows.reduce((n, a) => n + (a.points_awarded ?? 0), 0);
      const ok = rows.filter((a) => a.is_correct).length;
      console.log(`  Quiz #${idx + 1}: ${rows.length} réponses, ${ok} bonnes, ${pts} pts` +
        (rows.length === 0 ? "  ← aucune réponse enregistrée (n'a pas joué ce quiz)" : ""));
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
