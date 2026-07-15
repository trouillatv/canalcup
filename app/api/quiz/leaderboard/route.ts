// GET /api/quiz/leaderboard — classements Quiz.
//
//  - ranking        : CHAMPIONNAT (cumul de toutes les sessions ; le vrai
//                     classement qui qualifie pour la Finale). Top N = qualifiés.
//  - current        : classement du DERNIER quiz (« qui a gagné ce quiz ? ») —
//                     gratifiant même s'il ne dure que quelques minutes.
//  - finishedSessions : nb de quiz Live terminés (pour « encore N quiz »).
//
// Les points stockés incluent déjà le coefficient de mode (Live 100 % / Solo).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { selectAll } from "@/lib/data/select-all";
import { QUIZ_CHAMPIONSHIP, isQualifClosed, isFinalsExcluded } from "@/lib/config/quiz-championship";
import { countedQuestionIdsFromSessions } from "@/lib/quiz/session";

type Tally = { points: number; correct: number; answered: number };

function rank(
  rows: { user_id: string; points_awarded: number | null; is_correct: boolean }[],
  nameById: Map<string, string>,
  myId: string | null
) {
  const byUser = new Map<string, Tally>();
  for (const r of rows) {
    const e = byUser.get(r.user_id) ?? { points: 0, correct: 0, answered: 0 };
    e.points += r.points_awarded ?? 0;
    e.answered += 1;
    if (r.is_correct) e.correct += 1;
    byUser.set(r.user_id, e);
  }
  return [...byUser.entries()]
    .map(([uid, e]) => ({ user_id: uid, name: nameById.get(uid) ?? "Joueur", ...e }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct)
    .map((r, i) => ({ ...r, rank: i + 1, isMe: r.user_id === myId }));
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const viewerIsAdmin = await isAdminRequest(req);

  // ⚠️ selectAll (paginé) : PostgREST tronque chaque réponse à 1000 lignes. Avec
  // >1000 réponses quiz, un `.select()` simple SOUS-COMPTAIT les points (un joueur
  // affichait 92 au lieu de 121). On lit TOUTES les lignes.
  const [allRows, { data: recent }, { count: finishedSessions }] = await Promise.all([
    selectAll<{ user_id: string; points_awarded: number | null; is_correct: boolean; quiz_session_id: string | null; question_id: string | null }>(
      admin,
      "quiz_answers",
      "user_id, points_awarded, is_correct, quiz_session_id, question_id"
    ),
    admin.from("quiz_session").select("id, status").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("quiz_session").select("id", { count: "exact", head: true }).eq("status", "finished"),
  ]);
  const { data: sessions } = await admin
    .from("quiz_session")
    .select("id, status, created_at, ended_at, question_ids")
    .order("created_at", { ascending: true });

  const rows = allRows ?? [];
  const countedIds = countedQuestionIdsFromSessions((sessions ?? []) as { created_at: string | null; question_ids: unknown }[]);
  const countedRows = rows.filter((r) => {
    if (!r.question_id) return true;
    return countedIds.has(r.question_id);
  });
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = ids.length
    ? await admin.from("users").select("id, display_name, name, email").in("id", ids)
    : { data: [] as { id: string; display_name: string | null; name: string | null; email: string | null }[] };
  const nameById = new Map(
    (users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"])
  );
  // Comptes « hors concours » (organisateurs) : score visible mais jamais finaliste.
  const excludedIds = new Set(
    (users ?? []).filter((u) => isFinalsExcluded(u.email)).map((u) => u.id)
  );

  let myId: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
    myId = me?.id ?? null;
  }

  // Qualification : on ne compte QUE les vrais joueurs vers les places de finaliste
  // (un hors-concours en tête ne « vole » pas une place au top 5).
  // Pas de finale (finale.enabled=false) → aucune qualification, juste le cumul.
  const finaleOn = QUIZ_CHAMPIONSHIP.finale.enabled;
  let finalPos = 0;
  const championship = rank(countedRows, nameById, myId).map((r) => {
    const horsConcours = excludedIds.has(r.user_id);
    if (!horsConcours) finalPos += 1;
    return {
      ...r,
      horsConcours,
      qualified: finaleOn && !horsConcours && finalPos <= QUIZ_CHAMPIONSHIP.finalists,
    };
  });

  // Classement d'UN quiz (« qui a gagné ce quiz ? ») : on somme TOUTES les
  // réponses de la session, sans le filtre des questions comptées. Le plafond
  // « 60 par quiz » est une règle du CHAMPIONNAT (cumul) ; l'appliquer ici
  // amputait le résultat du Live des questions réellement posées mais absentes
  // de question_ids (cf. review.ts « questions répondues non listées »).
  // Les points stockés reflètent déjà le barème en vigueur au moment du jeu.
  const currentRows = recent?.id ? rows.filter((r) => r.quiz_session_id === recent.id) : [];
  const current = rank(currentRows, nameById, myId);
  const sessionLeaderboards = (sessions ?? []).map((s, idx) => ({
    id: s.id,
    label: `Quiz #${idx + 1}`,
    status: s.status,
    created_at: s.created_at,
    ended_at: s.ended_at,
    ranking: rank(rows.filter((r) => r.quiz_session_id === s.id), nameById, myId),
  }));

  return NextResponse.json(
    {
      ranking: championship,
      current,
      currentSessionStatus: recent?.status ?? null,
      finishedSessions: finishedSessions ?? 0,
      plannedQuizzes: QUIZ_CHAMPIONSHIP.schedule.length,
      finalists: QUIZ_CHAMPIONSHIP.finalists,
      qualifClosed: isQualifClosed(),
      finale: QUIZ_CHAMPIONSHIP.finale,
      schedule: QUIZ_CHAMPIONSHIP.schedule,
      sessions: sessionLeaderboards,
      viewerIsAdmin,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
