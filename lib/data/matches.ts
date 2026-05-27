import { createClient } from "@/lib/supabase/server";
import { MOCK_MATCHES, MOCK_PREDICTION_TRENDS } from "@/lib/mock-data";
import type { Match, PredictionTrend } from "@/lib/supabase/types";

export async function getMatches(): Promise<Match[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error || !data?.length) return MOCK_MATCHES;
    return data as Match[];
  } catch {
    return MOCK_MATCHES;
  }
}

// Classements de groupes calculés DEPUIS les matchs (tous les groupes A→L),
// pas depuis la table standings (qui n'a que le groupe A). Auto-mis à jour
// quand les matchs se terminent ; avant le tournoi tout est à 0, mais les 12
// groupes apparaissent avec leurs équipes.
export interface GroupStandingRow {
  team_name_fr: string;
  team_flag: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  group_name: string;
}

export async function getGroupStandings(): Promise<GroupStandingRow[]> {
  try {
    const supabase = await createClient();
    const { data: matches } = await supabase
      .from("matches")
      .select("team_a, team_b, flag_a, flag_b, stage, status, score_a, score_b")
      .eq("phase", "Groupe");
    if (!matches?.length) return [];

    type T = { name: string; flag: string; played: number; won: number; draw: number; lost: number; gf: number; ga: number };
    const groups = new Map<string, Map<string, T>>();
    const ensure = (stage: string, name: string, flag: string | null): T => {
      if (!groups.has(stage)) groups.set(stage, new Map());
      const g = groups.get(stage)!;
      if (!g.has(name)) g.set(name, { name, flag: flag ?? "", played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0 });
      return g.get(name)!;
    };

    for (const m of matches as { team_a: string; team_b: string; flag_a: string | null; flag_b: string | null; stage: string | null; status: string; score_a: number | null; score_b: number | null }[]) {
      if (!m.stage) continue;
      const a = ensure(m.stage, m.team_a, m.flag_a);
      const b = ensure(m.stage, m.team_b, m.flag_b);
      if (m.status === "finished" && m.score_a != null && m.score_b != null) {
        a.played++; b.played++;
        a.gf += m.score_a; a.ga += m.score_b; b.gf += m.score_b; b.ga += m.score_a;
        if (m.score_a > m.score_b) { a.won++; b.lost++; }
        else if (m.score_a < m.score_b) { b.won++; a.lost++; }
        else { a.draw++; b.draw++; }
      }
    }

    const rows: GroupStandingRow[] = [];
    for (const stage of [...groups.keys()].sort()) {
      const arr = [...groups.get(stage)!.values()]
        .map((t) => ({ ...t, points: t.won * 3 + t.draw, diff: t.gf - t.ga }))
        .sort((x, y) => y.points - x.points || y.diff - x.diff || y.gf - x.gf || x.name.localeCompare(y.name));
      arr.forEach((t, i) =>
        rows.push({
          team_name_fr: t.name, team_flag: t.flag, rank: i + 1,
          played: t.played, won: t.won, draw: t.draw, lost: t.lost,
          goals_for: t.gf, goals_against: t.ga, goal_diff: t.diff, points: t.points,
          group_name: stage,
        })
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function getPredictionTrends(): Promise<Record<string, PredictionTrend>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("predictions")
      .select("match_id, prediction_result");
    if (error || !data?.length) return MOCK_PREDICTION_TRENDS;

    const map: Record<string, { total: number; a: number; draw: number; b: number }> = {};
    for (const row of data) {
      if (!map[row.match_id]) map[row.match_id] = { total: 0, a: 0, draw: 0, b: 0 };
      map[row.match_id].total++;
      if (row.prediction_result === "A") map[row.match_id].a++;
      else if (row.prediction_result === "DRAW") map[row.match_id].draw++;
      else map[row.match_id].b++;
    }

    const result: Record<string, PredictionTrend> = {};
    for (const [matchId, counts] of Object.entries(map)) {
      const t = counts.total || 1;
      result[matchId] = {
        match_id: matchId,
        total: counts.total,
        votes_a: counts.a,
        votes_draw: counts.draw,
        votes_b: counts.b,
        pct_a: Math.round((counts.a / t) * 100),
        pct_draw: Math.round((counts.draw / t) * 100),
        pct_b: Math.round((counts.b / t) * 100),
      };
    }
    return result;
  } catch {
    return MOCK_PREDICTION_TRENDS;
  }
}
