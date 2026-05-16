import { createClient } from "@/lib/supabase/server";
import { MOCK_TEAMS, MOCK_LEADERBOARD } from "@/lib/mock-data";
import type { Team, LeaderboardRow } from "@/lib/supabase/types";

export async function getTeams(): Promise<Team[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .order("total_points", { ascending: false });
    if (error || !data?.length) return MOCK_TEAMS;
    return data as Team[];
  } catch {
    return MOCK_TEAMS;
  }
}

export async function getTeamById(id: string): Promise<Team | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("teams")
      .select("*, members:users(*)")
      .eq("id", id)
      .single();
    if (error || !data) return MOCK_TEAMS.find((t) => t.id === id) ?? null;
    return data as Team;
  } catch {
    return MOCK_TEAMS.find((t) => t.id === id) ?? null;
  }
}

export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  try {
    const supabase = await createClient();
    const { data: teams, error } = await supabase
      .from("teams")
      .select("*");
    if (error || !teams?.length) return MOCK_LEADERBOARD;

    // Fetch all scoring tables in parallel
    const [
      { data: predPoints },
      { data: bonusPoints },
      { data: quizPoints },
      { data: babyPoints },
    ] = await Promise.all([
      supabase.from("predictions").select("team_id, points_awarded"),
      supabase.from("bonus_predictions").select("team_id, points_awarded"),
      supabase.from("quiz_answers").select("team_id, points_awarded"),
      supabase.from("babyfoot_matches").select("team_a_id, team_b_id, score_a, score_b, status"),
    ]);

    const rows: LeaderboardRow[] = teams.map((team) => {
      const pp = (predPoints ?? [])
        .filter((r) => r.team_id === team.id)
        .reduce((s: number, r: { points_awarded: number }) => s + (r.points_awarded ?? 0), 0);
      const bp_bonus = (bonusPoints ?? [])
        .filter((r) => r.team_id === team.id)
        .reduce((s: number, r: { points_awarded: number }) => s + (r.points_awarded ?? 0), 0);
      const qp = (quizPoints ?? [])
        .filter((r) => r.team_id === team.id)
        .reduce((s: number, r: { points_awarded: number }) => s + (r.points_awarded ?? 0), 0);
      const bp = (babyPoints ?? [])
        .filter((m) => m.status === "finished" && (
          (m.team_a_id === team.id && (m.score_a ?? 0) > (m.score_b ?? 0)) ||
          (m.team_b_id === team.id && (m.score_b ?? 0) > (m.score_a ?? 0))
        )).length * 10;

      const total = pp + bp_bonus + qp + bp;

      return {
        team: team as Team,
        points_predictions: pp,
        points_quiz: qp,
        points_babyfoot: bp,
        points_votes: 0,
        points_bonus: bp_bonus,
        total,
        rank: 0,
      };
    });

    // Sort by total descending, then assign rank
    rows.sort((a, b) => b.total - a.total);
    rows.forEach((r, i) => { r.rank = i + 1; });

    return rows;
  } catch {
    return MOCK_LEADERBOARD;
  }
}
