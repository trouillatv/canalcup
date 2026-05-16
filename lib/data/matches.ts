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
