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
import { QUIZ_CHAMPIONSHIP, isQualifClosed } from "@/lib/config/quiz-championship";

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

  const [{ data: allRows }, { data: recent }, { count: finishedSessions }] = await Promise.all([
    admin.from("quiz_answers").select("user_id, points_awarded, is_correct, quiz_session_id"),
    admin.from("quiz_session").select("id, status").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("quiz_session").select("id", { count: "exact", head: true }).eq("status", "finished"),
  ]);

  const rows = allRows ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { data: users } = ids.length
    ? await admin.from("users").select("id, display_name, name").in("id", ids)
    : { data: [] as { id: string; display_name: string | null; name: string | null }[] };
  const nameById = new Map(
    (users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"])
  );

  let myId: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
    myId = me?.id ?? null;
  }

  const championship = rank(rows, nameById, myId).map((r) => ({
    ...r,
    qualified: r.rank <= QUIZ_CHAMPIONSHIP.finalists,
  }));

  const currentRows = recent?.id ? rows.filter((r) => r.quiz_session_id === recent.id) : [];
  const current = rank(currentRows, nameById, myId);

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
      viewerIsAdmin,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
