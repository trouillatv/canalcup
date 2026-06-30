// GET /api/quiz/leaderboard — CLASSEMENT CHAMPIONNAT Quiz.
//
// Cumul de TOUTES les réponses quiz (toutes sessions, Live + Solo : les points
// stockés incluent déjà le coefficient de mode). Les N premiers (config) sont
// « Qualifiés pour la Grande Finale ». Après la date de clôture, le top N est
// figé (= les finalistes).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { QUIZ_CHAMPIONSHIP, isQualifClosed } from "@/lib/config/quiz-championship";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("quiz_answers")
    .select("user_id, points_awarded, is_correct");

  const byUser = new Map<string, { points: number; correct: number; answered: number }>();
  for (const r of rows ?? []) {
    const e = byUser.get(r.user_id) ?? { points: 0, correct: 0, answered: 0 };
    e.points += r.points_awarded ?? 0;
    e.answered += 1;
    if (r.is_correct) e.correct += 1;
    byUser.set(r.user_id, e);
  }

  const ids = [...byUser.keys()];
  const { data: users } = ids.length
    ? await admin.from("users").select("id, display_name, name").in("id", ids)
    : { data: [] as { id: string; display_name: string | null; name: string | null }[] };
  const nameById = new Map(
    (users ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"])
  );

  // Mon profil (pour me situer dans le classement).
  let myId: string | null = null;
  if (user) {
    const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
    myId = me?.id ?? null;
  }

  const ranking = [...byUser.entries()]
    .map(([uid, e]) => ({
      user_id: uid,
      name: nameById.get(uid) ?? "Joueur",
      points: e.points,
      correct: e.correct,
      answered: e.answered,
    }))
    .sort((a, b) => b.points - a.points || b.correct - a.correct)
    .map((r, i) => ({
      ...r,
      rank: i + 1,
      qualified: i < QUIZ_CHAMPIONSHIP.finalists,
      isMe: r.user_id === myId,
    }));

  return NextResponse.json(
    {
      ranking,
      finalists: QUIZ_CHAMPIONSHIP.finalists,
      qualifClosed: isQualifClosed(),
      finale: QUIZ_CHAMPIONSHIP.finale,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
