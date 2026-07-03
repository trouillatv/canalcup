// 🔍 Audit Quiz — SOURCE UNIQUE de vérité pour rendre chaque point explicable.
//
// Réutilisé par : l'export CSV admin (/api/admin/quiz/export) ET le détail
// joueur (/api/quiz/player-detail + panneau sur /quiz). Un seul calcul → les
// chiffres sont IDENTIQUES partout, et la somme par joueur colle exactement au
// classement live (sum(quiz_answers.points_awarded)).
//
// Modèle de stockage (rappel) :
//   - Live  : points_awarded ∈ {5, 3, 0} (5 si bonne réponse <5s, 3 si ≥5s),
//             mode="live".
//   - Solo  : points_awarded ∈ {2, 0} (base 3 × coefficient 0,7 ≈ 2, PAS de
//             bonus rapidité), mode="solo".
// Le point stocké EST déjà le point du CHAMPIONNAT (coefficient inclus).
// Le classement GÉNÉRAL CanalCup, lui, plafonne le total quiz à 50 (min(50,·)).
//
// ⚠️ Cet audit ne RECALCULE rien et ne modifie rien : il relit ce qui est en
// base et l'explique (raw / type / championnat / global capé).

import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import { QUIZ_FAST_THRESHOLD_MS, QUIZ_SOLO_COEFFICIENT, quizGlobalPoints } from "@/lib/scoring";

// Base d'un point Solo AVANT coefficient (sert à expliquer 3 × 0,7 ≈ 2).
const SOLO_BASE = 3;

export type PointsType =
  | "live_fast" // bonne réponse Live <5s → +5
  | "live_normal" // bonne réponse Live ≥5s → +3
  | "solo_correct" // bonne réponse Solo → base 3 × 0,7 ≈ 2
  | "wrong" // réponse donnée mais fausse → 0
  | "no_answer"; // pas de réponse / timeout → 0

export const POINTS_TYPE_LABEL: Record<PointsType, string> = {
  live_fast: "Live rapide (+5)",
  live_normal: "Live normal (+3)",
  solo_correct: "Solo (+2)",
  wrong: "Faux (0)",
  no_answer: "Non répondu (0)",
};

export interface AuditAnswerRow {
  quiz_session_id: string;
  quiz_title: string;
  quiz_date: string | null;
  mode: string; // "live" | "solo" | "" (non répondu)
  user_id: string;
  display_name: string;
  team_name: string;
  question_index: number; // 1-based, ordre réel posé
  question_id: string;
  question_text: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string; // explication affichée pendant le quiz (peut être vide)
  user_answer: string; // "" si aucune
  is_correct: boolean;
  answered: boolean;
  response_time_ms: number | null;
  points_awarded_raw: number; // base AVANT coefficient (Live = final ; Solo = 3)
  points_type: PointsType;
  championship_points: number; // = points_awarded stocké (compte pour le championnat)
  was_speed_bonus: boolean;
  was_solo: boolean;
  solo_coefficient: number | null;
  already_answered: boolean;
  created_at: string | null;
}

export interface AuditPlayerSummary {
  user_id: string;
  display_name: string;
  team_name: string;
  questions_total: number;
  questions_answered: number;
  correct_count: number;
  wrong_count: number;
  no_answer_count: number;
  fast_correct_count: number;
  normal_correct_count: number;
  solo_correct_count: number;
  avg_response_time_ms: number | null;
  fastest_ms: number | null; // réponse la plus rapide (toutes réponses données)
  best_streak: number; // plus longue série de bonnes réponses consécutives (dans une session)
  sessions: { title: string; played: boolean }[]; // participation par quiz
  raw_quiz_points: number;
  championship_quiz_points: number; // = classement Quiz réel (points comptés au championnat)
  // Classement GÉNÉRAL : contribution normalisée entre 5 et 50 selon le SCORE.
  quiz_rank: number | null; // rang au championnat quiz (1 = meilleur), null si non-participant — indicatif
  participants_count: number; // nb de participants au championnat quiz (points > 0)
  global_quiz_points: number; // contribution réelle au général (0, ou 5..50 selon le score)
}

export interface QuizAudit {
  answers: AuditAnswerRow[];
  summaries: AuditPlayerSummary[];
}

type RawAnswer = {
  user_id: string;
  question_id: string;
  answer: string | null;
  is_correct: boolean | null;
  response_time_ms: number | null;
  points_awarded: number | null;
  quiz_session_id: string | null;
  mode: string | null;
  created_at: string | null;
};
type RawQuestion = {
  id: string;
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: string;
  explanation: string | null;
};
type RawSession = { id: string; created_at: string | null; question_ids: unknown };

// Classe une réponse (ou son absence) → type + points bruts.
function classify(a: RawAnswer | undefined): {
  answered: boolean;
  type: PointsType;
  raw: number;
  championship: number;
  speedBonus: boolean;
  solo: boolean;
} {
  if (!a) return { answered: false, type: "no_answer", raw: 0, championship: 0, speedBonus: false, solo: false };
  const solo = a.mode === "solo";
  const championship = a.points_awarded ?? 0;
  const hasAnswer = (a.answer ?? "") !== "";
  const correct = !!a.is_correct && hasAnswer;
  if (!hasAnswer) {
    return { answered: false, type: "no_answer", raw: 0, championship: 0, speedBonus: false, solo };
  }
  if (!correct) {
    return { answered: true, type: "wrong", raw: 0, championship: 0, speedBonus: false, solo };
  }
  if (solo) {
    return { answered: true, type: "solo_correct", raw: SOLO_BASE, championship, speedBonus: false, solo: true };
  }
  const fast = (a.response_time_ms ?? Infinity) <= QUIZ_FAST_THRESHOLD_MS;
  return {
    answered: true,
    type: fast ? "live_fast" : "live_normal",
    raw: championship, // Live : le stocké EST déjà la base (5 ou 3)
    championship,
    speedBonus: fast,
    solo: false,
  };
}

/**
 * Construit l'audit complet du quiz (toutes sessions, tous joueurs, Live + Solo).
 * @param onlyUserId si fourni, ne renvoie que les lignes/résumé de ce joueur
 *        (les totaux du joueur restent EXACTS — mêmes règles que pour tous).
 */
export async function buildQuizAudit(onlyUserId?: string): Promise<QuizAudit> {
  const admin = createAdminClient();

  const [answersRaw, questionsRaw, sessionsRaw, usersRaw, teamsRaw] = await Promise.all([
    selectAll<RawAnswer>(
      admin,
      "quiz_answers",
      "user_id, question_id, answer, is_correct, response_time_ms, points_awarded, quiz_session_id, mode, created_at"
    ),
    selectAll<RawQuestion>(
      admin,
      "quiz_questions",
      "id, question, answer_a, answer_b, answer_c, answer_d, correct_answer, explanation"
    ),
    selectAll<RawSession>(admin, "quiz_session", "id, created_at, question_ids"),
    selectAll<{ id: string; display_name: string | null; name: string | null; team_id: string | null }>(
      admin,
      "users",
      "id, display_name, name, team_id"
    ),
    selectAll<{ id: string; name: string }>(admin, "teams", "id, name"),
  ]);

  const qById = new Map(questionsRaw.map((q) => [q.id, q]));
  const teamName = new Map(teamsRaw.map((t) => [t.id, t.name]));
  const userInfo = new Map(
    usersRaw.map((u) => [
      u.id,
      {
        display_name: (u.display_name?.trim() || u.name?.trim() || "Joueur") as string,
        team_name: u.team_id ? teamName.get(u.team_id) ?? "" : "",
      },
    ])
  );

  // Sessions ordonnées par création → numérotation « Quiz #1, #2… ».
  const sessions = [...sessionsRaw].sort(
    (a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime()
  );
  const sessionMeta = new Map<string, { title: string; date: string | null; ids: string[] }>();
  sessions.forEach((s, i) => {
    const ids = Array.isArray(s.question_ids) ? (s.question_ids as string[]) : [];
    sessionMeta.set(s.id, { title: `Quiz #${i + 1}`, date: s.created_at, ids });
  });

  // Regroupe les réponses par session (clé null/inconnue → bucket « hors session »).
  const NONE = "__none__";
  const bySession = new Map<string, RawAnswer[]>();
  for (const a of answersRaw) {
    const key = a.quiz_session_id && sessionMeta.has(a.quiz_session_id) ? a.quiz_session_id : NONE;
    if (!bySession.has(key)) bySession.set(key, []);
    bySession.get(key)!.push(a);
  }

  const rows: AuditAnswerRow[] = [];

  const buildSession = (
    sid: string,
    title: string,
    date: string | null,
    baseIds: string[],
    answers: RawAnswer[]
  ) => {
    // Liste des questions RÉELLEMENT posées, dans l'ordre : question_ids de la
    // session puis toute question répondue non listée (extend/anciennes sessions)
    // → garantit qu'AUCUNE réponse stockée n'est oubliée (somme = classement live).
    const seen = new Set(baseIds);
    const extra: { id: string; t: number }[] = [];
    for (const a of answers) {
      if (!seen.has(a.question_id)) {
        seen.add(a.question_id);
        extra.push({ id: a.question_id, t: new Date(a.created_at ?? 0).getTime() });
      }
    }
    extra.sort((x, y) => x.t - y.t);
    const fullIds = [...baseIds, ...extra.map((e) => e.id)];

    // Participants = joueurs ayant ≥1 réponse dans cette session.
    const participants = [...new Set(answers.map((a) => a.user_id))];
    // Index des réponses par (user|question).
    const ansByKey = new Map<string, RawAnswer>();
    for (const a of answers) ansByKey.set(`${a.user_id}|${a.question_id}`, a);

    for (const uid of participants) {
      if (onlyUserId && uid !== onlyUserId) continue;
      const info = userInfo.get(uid) ?? { display_name: "Joueur", team_name: "" };
      fullIds.forEach((qid, idx) => {
        const q = qById.get(qid);
        const a = ansByKey.get(`${uid}|${qid}`);
        const c = classify(a);
        rows.push({
          quiz_session_id: sid,
          quiz_title: title,
          quiz_date: date,
          mode: a?.mode ?? "",
          user_id: uid,
          display_name: info.display_name,
          team_name: info.team_name,
          question_index: idx + 1,
          question_id: qid,
          question_text: q?.question ?? "(question supprimée)",
          answer_a: q?.answer_a ?? "",
          answer_b: q?.answer_b ?? "",
          answer_c: q?.answer_c ?? "",
          answer_d: q?.answer_d ?? "",
          correct_answer: q?.correct_answer ?? "",
          explanation: q?.explanation ?? "",
          user_answer: a?.answer ?? "",
          is_correct: c.type === "live_fast" || c.type === "live_normal" || c.type === "solo_correct",
          answered: c.answered,
          response_time_ms: a && c.answered ? a.response_time_ms ?? null : null,
          points_awarded_raw: c.raw,
          points_type: c.type,
          championship_points: c.championship,
          was_speed_bonus: c.speedBonus,
          was_solo: c.solo,
          solo_coefficient: c.solo ? QUIZ_SOLO_COEFFICIENT : null,
          already_answered: !!a,
          created_at: a?.created_at ?? null,
        });
      });
    }
  };

  for (const [sid, ans] of bySession) {
    if (sid === NONE) {
      buildSession(NONE, "Hors session", null, [], ans);
    } else {
      const meta = sessionMeta.get(sid)!;
      buildSession(sid, meta.title, meta.date, meta.ids, ans);
    }
  }

  // Résumé par joueur (agrégé sur toutes ses lignes).
  const byUser = new Map<string, AuditAnswerRow[]>();
  for (const r of rows) {
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
    byUser.get(r.user_id)!.push(r);
  }
  // ⚠️ Pour calculer le rang + la pondération globale d'UN joueur à l'identique,
  // il faut le classement de TOUS. Quand onlyUserId est fourni, on n'a construit
  // les lignes que pour lui → on recalcule ici le total championnat de chacun à
  // partir des réponses brutes (mêmes règles : classify), puis on pondère.
  const championshipAll = new Map<string, number>();
  for (const a of answersRaw) {
    const c = classify(a);
    championshipAll.set(a.user_id, (championshipAll.get(a.user_id) ?? 0) + c.championship);
  }
  const globalByUser = quizGlobalPoints(championshipAll);
  const participantsCount = [...championshipAll.values()].filter((p) => p > 0).length;
  // Rang (compétition, ex æquo partagent le même rang) parmi les participants.
  const rankByUser = new Map<string, number>();
  const rankedParts = [...championshipAll.entries()]
    .filter(([, p]) => p > 0)
    .sort((a, b) => b[1] - a[1]);
  rankedParts.forEach(([uid, pts], idx) => {
    if (idx > 0 && rankedParts[idx - 1][1] === pts) rankByUser.set(uid, rankByUser.get(rankedParts[idx - 1][0])!);
    else rankByUser.set(uid, idx + 1);
  });

  // Liste ordonnée des vrais quiz (#1, #2…) pour la participation.
  const allSessionTitles = [...sessionMeta.values()].map((m) => m.title);

  const summaries: AuditPlayerSummary[] = [];
  for (const [uid, rs] of byUser) {
    const info = userInfo.get(uid) ?? { display_name: "Joueur", team_name: "" };
    const answered = rs.filter((r) => r.answered);
    const rtVals = answered.map((r) => r.response_time_ms).filter((v): v is number => v != null);
    const championship = championshipAll.get(uid) ?? rs.reduce((s, r) => s + r.championship_points, 0);

    // Plus longue série de bonnes réponses consécutives (par session, dans l'ordre).
    const bySess = new Map<string, AuditAnswerRow[]>();
    for (const r of rs) {
      if (!bySess.has(r.quiz_session_id)) bySess.set(r.quiz_session_id, []);
      bySess.get(r.quiz_session_id)!.push(r);
    }
    let bestStreak = 0;
    for (const srows of bySess.values()) {
      const ordered = [...srows].sort((a, b) => a.question_index - b.question_index);
      let cur = 0;
      for (const r of ordered) {
        if (r.is_correct) { cur += 1; if (cur > bestStreak) bestStreak = cur; }
        else cur = 0;
      }
    }
    const playedTitles = new Set(rs.map((r) => r.quiz_title));

    summaries.push({
      user_id: uid,
      display_name: info.display_name,
      team_name: info.team_name,
      questions_total: rs.length,
      questions_answered: answered.length,
      correct_count: rs.filter((r) => r.is_correct).length,
      wrong_count: rs.filter((r) => r.points_type === "wrong").length,
      no_answer_count: rs.filter((r) => r.points_type === "no_answer").length,
      fast_correct_count: rs.filter((r) => r.points_type === "live_fast").length,
      normal_correct_count: rs.filter((r) => r.points_type === "live_normal").length,
      solo_correct_count: rs.filter((r) => r.points_type === "solo_correct").length,
      avg_response_time_ms: rtVals.length ? Math.round(rtVals.reduce((s, v) => s + v, 0) / rtVals.length) : null,
      fastest_ms: rtVals.length ? Math.min(...rtVals) : null,
      best_streak: bestStreak,
      sessions: allSessionTitles.map((t) => ({ title: t, played: playedTitles.has(t) })),
      raw_quiz_points: rs.reduce((s, r) => s + r.points_awarded_raw, 0),
      championship_quiz_points: championship,
      quiz_rank: rankByUser.get(uid) ?? null,
      participants_count: participantsCount,
      global_quiz_points: globalByUser.get(uid) ?? 0,
    });
  }

  // Tri lisible : par points championnat décroissants.
  summaries.sort((a, b) => b.championship_quiz_points - a.championship_quiz_points);
  rows.sort(
    (a, b) =>
      a.quiz_title.localeCompare(b.quiz_title) ||
      a.display_name.localeCompare(b.display_name) ||
      a.question_index - b.question_index
  );

  return { answers: rows, summaries };
}
