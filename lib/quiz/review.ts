// 🔁 « Revoir le quiz » — vue PUBLIQUE d'une session terminée : chaque question
// avec sa bonne réponse, l'explication, et la RÉPARTITION des votes (A/B/C/D) +
// taux de réussite. Aucune réponse individuelle exposée (juste des compteurs).
//
// Bonus : titres automatiques de fin de quiz (sans impact sur les points) —
// Éclair / Sniper / Professeur / Tête brûlée / Dernière seconde.
//
// Ne s'ouvre que sur une session TERMINÉE (anti-spoil pendant un Live).

import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";

export interface ReviewQuestion {
  index: number;
  question_id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string;
  distribution: { A: number; B: number; C: number; D: number };
  responders: number;
  correct_pct: number; // 0..100
}

export interface QuizTitle {
  key: string;
  emoji: string;
  label: string;
  winner: string;
  detail: string;
}

export interface QuizReview {
  available: boolean;
  reason?: "no_session" | "not_finished";
  session: { id: string; title: string } | null;
  questions: ReviewQuestion[];
  titles: QuizTitle[];
}

type Ans = {
  user_id: string;
  question_id: string;
  answer: string | null;
  is_correct: boolean | null;
  response_time_ms: number | null;
};

export async function buildQuizReview(sessionId?: string): Promise<QuizReview> {
  const admin = createAdminClient();

  // Session ciblée (donnée, sinon la plus récente) + numérotation « Quiz #N ».
  const { data: sessions } = await admin
    .from("quiz_session")
    .select("id, created_at, status, question_ids")
    .order("created_at", { ascending: true });
  const list = sessions ?? [];
  if (!list.length) return { available: false, reason: "no_session", session: null, questions: [], titles: [] };

  const idx = sessionId ? list.findIndex((s) => s.id === sessionId) : list.length - 1;
  const session = idx >= 0 ? list[idx] : list[list.length - 1];
  const title = `Quiz #${(idx >= 0 ? idx : list.length - 1) + 1}`;

  if (session.status !== "finished") {
    return { available: false, reason: "not_finished", session: { id: session.id, title }, questions: [], titles: [] };
  }

  const questionIds = Array.isArray(session.question_ids) ? (session.question_ids as string[]) : [];

  // Réponses de CETTE session (paginé) + questions + noms.
  const answers = await selectAll<Ans>(
    admin,
    "quiz_answers",
    "user_id, question_id, answer, is_correct, response_time_ms",
    (q) => q.eq("quiz_session_id", session.id)
  );

  // Questions réellement posées : question_ids ∪ questions répondues non listées.
  const seen = new Set(questionIds);
  for (const a of answers) if (!seen.has(a.question_id)) { seen.add(a.question_id); questionIds.push(a.question_id); }

  const { data: questionsRaw } = await admin
    .from("quiz_questions")
    .select("id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, explanation")
    .in("id", questionIds.length ? questionIds : ["00000000-0000-0000-0000-000000000000"]);
  const qById = new Map((questionsRaw ?? []).map((q) => [q.id, q]));

  // Répartition par question.
  const questions: ReviewQuestion[] = questionIds.map((qid, i) => {
    const q = qById.get(qid);
    const dist = { A: 0, B: 0, C: 0, D: 0 };
    let responders = 0;
    let correct = 0;
    for (const a of answers) {
      if (a.question_id !== qid) continue;
      const key = a.answer as "A" | "B" | "C" | "D";
      if (key === "A" || key === "B" || key === "C" || key === "D") {
        dist[key] += 1;
        responders += 1;
        if (a.is_correct) correct += 1;
      }
    }
    return {
      index: i + 1,
      question_id: qid,
      question_text: q?.question ?? "(question supprimée)",
      answer_a: q?.answer_a ?? "",
      answer_b: q?.answer_b ?? "",
      answer_c: q?.answer_c ?? "",
      answer_d: q?.answer_d ?? "",
      correct_answer: q?.correct_answer ?? "",
      explanation: q?.explanation ?? "",
      distribution: dist,
      responders,
      correct_pct: responders ? Math.round((correct / responders) * 100) : 0,
    };
  });

  const titles = await computeTitles(admin, answers);
  return { available: true, session: { id: session.id, title }, questions, titles };
}

// Titres automatiques — sans impact sur les points, juste pour l'ambiance.
async function computeTitles(
  admin: ReturnType<typeof createAdminClient>,
  answers: Ans[]
): Promise<QuizTitle[]> {
  if (!answers.length) return [];

  // Questions où UN SEUL joueur a trouvé (pour « Professeur »).
  const correctByQ = new Map<string, string[]>();
  for (const a of answers) {
    if (a.is_correct) {
      if (!correctByQ.has(a.question_id)) correctByQ.set(a.question_id, []);
      correctByQ.get(a.question_id)!.push(a.user_id);
    }
  }
  const uniqueSolverOfQ = new Map<string, string>(); // question → unique solver
  for (const [qid, users] of correctByQ) if (users.length === 1) uniqueSolverOfQ.set(qid, users[0]);

  type Stat = { answered: number; correct: number; sumTime: number; nTime: number; sub1s: number; uniques: number };
  const byUser = new Map<string, Stat>();
  const ensure = (u: string) => {
    if (!byUser.has(u)) byUser.set(u, { answered: 0, correct: 0, sumTime: 0, nTime: 0, sub1s: 0, uniques: 0 });
    return byUser.get(u)!;
  };
  for (const a of answers) {
    const hasAns = (a.answer ?? "") !== "";
    if (!hasAns) continue;
    const s = ensure(a.user_id);
    s.answered += 1;
    if (a.is_correct) s.correct += 1;
    if (a.response_time_ms != null) {
      s.sumTime += a.response_time_ms;
      s.nTime += 1;
      if (a.response_time_ms < 1000) s.sub1s += 1;
    }
  }
  for (const solver of uniqueSolverOfQ.values()) ensure(solver).uniques += 1;

  const ids = [...byUser.keys()];
  const { data: users } = await admin.from("users").select("id, display_name, name").in("id", ids.length ? ids : ["x"]);
  const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"]));
  const name = (u: string) => nameById.get(u) ?? "Joueur";

  const MIN_ANSWERED = 5; // évite qu'un joueur ayant répondu à 1 question rafle un titre
  const eligible = [...byUser.entries()].filter(([, s]) => s.answered >= MIN_ANSWERED);
  const titles: QuizTitle[] = [];

  // ⚡ Éclair : temps moyen le plus rapide.
  const withTime = eligible.filter(([, s]) => s.nTime > 0).map(([u, s]) => ({ u, avg: s.sumTime / s.nTime }));
  if (withTime.length) {
    const w = withTime.reduce((a, b) => (b.avg < a.avg ? b : a));
    titles.push({ key: "eclair", emoji: "⚡", label: "Éclair", winner: name(w.u), detail: `${(w.avg / 1000).toFixed(1).replace(".", ",")} s de moyenne` });
  }
  // 🎯 Sniper : meilleur taux de réussite.
  const withRate = eligible.map(([u, s]) => ({ u, rate: s.correct / s.answered, s }));
  if (withRate.length) {
    const w = withRate.reduce((a, b) => (b.rate > a.rate ? b : a));
    titles.push({ key: "sniper", emoji: "🎯", label: "Sniper", winner: name(w.u), detail: `${Math.round(w.rate * 100)} % de réussite` });
  }
  // 🧠 Professeur : le plus de questions trouvées en étant le SEUL (≥2).
  const profs = eligible.filter(([, s]) => s.uniques >= 2).map(([u, s]) => ({ u, n: s.uniques }));
  if (profs.length) {
    const w = profs.reduce((a, b) => (b.n > a.n ? b : a));
    titles.push({ key: "professeur", emoji: "🧠", label: "Professeur", winner: name(w.u), detail: `${w.n} questions trouvées en solo` });
  }
  // 😅 Tête brûlée : le plus de réponses en moins d'1 s.
  const hotheads = eligible.filter(([, s]) => s.sub1s >= 1).map(([u, s]) => ({ u, n: s.sub1s }));
  if (hotheads.length) {
    const w = hotheads.reduce((a, b) => (b.n > a.n ? b : a));
    titles.push({ key: "tete_brulee", emoji: "😅", label: "Tête brûlée", winner: name(w.u), detail: `${w.n} réponses en < 1 s` });
  }
  // 💤 Dernière seconde : temps moyen le plus LENT.
  if (withTime.length) {
    const w = withTime.reduce((a, b) => (b.avg > a.avg ? b : a));
    titles.push({ key: "derniere_seconde", emoji: "💤", label: "Dernière seconde", winner: name(w.u), detail: `${(w.avg / 1000).toFixed(1).replace(".", ",")} s de moyenne` });
  }

  return titles;
}
