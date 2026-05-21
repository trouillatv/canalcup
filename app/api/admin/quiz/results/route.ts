// GET /api/admin/quiz/results — résultats agrégés de la session quiz la
// plus récente (active OU terminée). Pour le panneau Résultats côté admin.
//
// On filtre quiz_answers par created_at >= session.created_at de la session
// ciblée — comme l'admin reset DELETE toutes les réponses, ce filtre rend
// les résultats "propres" même sans colonne quiz_session_id.
//
// Renvoie :
//   - session : meta (status, started_at, question_index, total)
//   - questionsAnswered : nb de questions dont au moins 1 joueur a répondu
//   - leaderboard : top joueurs (user_id, name, team_name, total_points,
//     correct, answered)
//   - teams : agrégat par équipe (team_id, name, total_points, players)
//
// Protégé par x-admin-secret.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. La session la plus récente (active ou terminée). Si aucune session
  //    n'existe jamais, on renvoie un état vide.
  const { data: session } = await supabase
    .from("quiz_session")
    .select("id, status, question_index, started_at, ended_at, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({
      session: null,
      questionsAnswered: 0,
      leaderboard: [],
      teams: [],
    });
  }

  const { count: total } = await supabase
    .from("quiz_questions")
    .select("*", { count: "exact", head: true });

  // 2. Toutes les réponses depuis le début de la session.
  const { data: answers } = await supabase
    .from("quiz_answers")
    .select("user_id, team_id, question_id, is_correct, points_awarded, created_at")
    .gte("created_at", session.created_at);

  const list = answers ?? [];

  // 3. Enrichit avec name (users) et name (teams).
  const userIds = Array.from(new Set(list.map((a) => a.user_id)));
  const teamIds = Array.from(new Set(list.map((a) => a.team_id)));

  const [{ data: users }, { data: teams }] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, name, team_id").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; name: string; team_id: string | null }[] }),
    teamIds.length
      ? supabase.from("teams").select("id, name").in("id", teamIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const userById = new Map((users ?? []).map((u) => [u.id, u]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  // 4. Agrégat par joueur.
  const byUser = new Map<
    string,
    { user_id: string; name: string; team_id: string; team_name: string; total_points: number; correct: number; answered: number }
  >();
  for (const a of list) {
    const k = a.user_id;
    if (!byUser.has(k)) {
      byUser.set(k, {
        user_id: a.user_id,
        name: userById.get(a.user_id)?.name ?? "Anonyme",
        team_id: a.team_id,
        team_name: teamById.get(a.team_id)?.name ?? "—",
        total_points: 0,
        correct: 0,
        answered: 0,
      });
    }
    const u = byUser.get(k)!;
    u.total_points += a.points_awarded ?? 0;
    if (a.is_correct) u.correct += 1;
    u.answered += 1;
  }

  // 5. Agrégat par équipe.
  const byTeam = new Map<
    string,
    { team_id: string; name: string; total_points: number; players: number; correct: number; answered: number }
  >();
  for (const u of byUser.values()) {
    if (!byTeam.has(u.team_id)) {
      byTeam.set(u.team_id, {
        team_id: u.team_id,
        name: u.team_name,
        total_points: 0,
        players: 0,
        correct: 0,
        answered: 0,
      });
    }
    const t = byTeam.get(u.team_id)!;
    t.total_points += u.total_points;
    t.players += 1;
    t.correct += u.correct;
    t.answered += u.answered;
  }

  const leaderboard = Array.from(byUser.values()).sort(
    (a, b) => b.total_points - a.total_points || b.correct - a.correct
  );
  const teamsRanked = Array.from(byTeam.values()).sort(
    (a, b) => b.total_points - a.total_points
  );

  const questionsAnswered = new Set(list.map((a) => a.question_id)).size;

  return NextResponse.json({
    session: {
      id: session.id,
      status: session.status,
      started_at: session.started_at,
      ended_at: session.ended_at,
      question_index: session.question_index,
      total: total ?? 0,
    },
    questionsAnswered,
    leaderboard,
    teams: teamsRanked,
  });
}
