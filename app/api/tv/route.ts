import { getMatches } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { getChallenges } from "@/lib/data/challenges";
import { createAdminClient } from "@/lib/supabase/admin";
import { AMBIANCE_STATES } from "@/lib/tv/hype";
import { NextResponse } from "next/server";
import type { Match } from "@/lib/supabase/types";

export const revalidate = 30;


async function getPreMatchStats(supabase: ReturnType<typeof createAdminClient>, match: Match, totalTeams: number) {
  const [{ data: preds }, { data: bonusPreds }] = await Promise.all([
    supabase
      .from("predictions")
      .select("team_id, prediction_result, predicted_score_a, predicted_score_b")
      .eq("match_id", match.id),
    supabase
      .from("bonus_predictions")
      .select("predicted_value")
      .eq("prediction_type", "top_scorer"),
  ]);

  const rows = preds ?? [];
  const teamsPredicted = new Set(rows.map((r) => r.team_id)).size;
  const teamsMissing = Math.max(0, totalTeams - teamsPredicted);

  // Result distribution
  const votesA = rows.filter((r) => r.prediction_result === "A").length;
  const votesB = rows.filter((r) => r.prediction_result === "B").length;
  const votesDraw = rows.filter((r) => r.prediction_result === "DRAW").length;
  const total = rows.length || 1;

  const pctA = Math.round((votesA / total) * 100);
  const pctB = Math.round((votesB / total) * 100);
  const pctDraw = 100 - pctA - pctB;

  const topResult: "A" | "DRAW" | "B" | null =
    votesA >= votesB && votesA >= votesDraw ? "A"
    : votesB >= votesA && votesB >= votesDraw ? "B"
    : votesDraw > 0 ? "DRAW" : null;

  const topPct = topResult === "A" ? pctA : topResult === "B" ? pctB : pctDraw;

  // Most predicted exact score
  const scoreCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.predicted_score_a !== null && r.predicted_score_a !== undefined
        && r.predicted_score_b !== null && r.predicted_score_b !== undefined) {
      const key = `${r.predicted_score_a}-${r.predicted_score_b}`;
      scoreCounts[key] = (scoreCounts[key] ?? 0) + 1;
    }
  }
  const topScore = Object.entries(scoreCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
  const topScoreCount = topScore ? scoreCounts[topScore] : 0;
  const topScorePct = Math.round((topScoreCount / total) * 100);

  // Most predicted top scorer from bonus predictions
  const scorerCounts: Record<string, number> = {};
  for (const b of bonusPreds ?? []) {
    scorerCounts[b.predicted_value] = (scorerCounts[b.predicted_value] ?? 0) + 1;
  }
  const topScorerEntry = Object.entries(scorerCounts).sort(([, a], [, b]) => b - a)[0];
  const topScorer = topScorerEntry?.[0] ?? null;
  const topScorerTotal = (bonusPreds ?? []).length || 1;
  const topScorerPct = topScorerEntry ? Math.round((topScorerEntry[1] / topScorerTotal) * 100) : 0;

  return {
    match,
    total_teams: totalTeams,
    teams_predicted: teamsPredicted,
    teams_missing: teamsMissing,
    votes_a: votesA,
    votes_b: votesB,
    votes_draw: votesDraw,
    pct_a: pctA,
    pct_b: pctB,
    pct_draw: pctDraw,
    top_result: topResult,
    top_pct: topPct,
    top_score: topScore,
    top_score_pct: topScorePct,
    top_scorer: topScorer,
    top_scorer_pct: topScorerPct,
  };
}

export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  // Events window: show events from 1h ago to 24h from now
  const windowStart = new Date(now.getTime() - 60 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();

  const [matches, leaderboard, brief, revivezPosts, allChallenges, { data: standings }, { data: events }] =
    await Promise.all([
      getMatches(),
      getLeaderboard(),
      getTodayBrief(),
      getRevivezPosts(),
      getChallenges(),
      supabase.from("standings").select("*").order("points", { ascending: false }),
      supabase
        .from("canal_cup_events")
        .select("*")
        .eq("is_active", true)
        .gte("starts_at", windowStart)
        .lte("starts_at", windowEnd)
        .order("starts_at", { ascending: true }),
    ]);

  // TV slide animations : on garde live + upcoming (max 5, live en haut).
  const challengesForTV = [
    ...allChallenges.filter((c) => c.status === "live"),
    ...allChallenges.filter((c) => c.status === "upcoming"),
  ].slice(0, 5);

  // Ambiance: dominant emoji from live match reactions
  let ambiance: { emoji: string; label: string; color: string; sub: string } | null = null;
  try {
    const liveMatch = matches.find((m) => m.status === "live" || m.status === "halftime");
    if (liveMatch) {
      const { data: rxData } = await supabase
        .from("match_reactions")
        .select("emoji")
        .eq("match_id", liveMatch.id);

      const counts: Record<string, number> = {};
      for (const r of rxData ?? []) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a);
      const [topEmoji, topCount] = sorted[0] ?? [];
      if (topEmoji && topCount >= 3) {
        const state = AMBIANCE_STATES[topEmoji];
        if (state) ambiance = { emoji: topEmoji, ...state };
      }
    }
  } catch {}

  // Pre-match stats — always for the next upcoming match (any horizon)
  let prematch = null;
  try {
    const nextMatch = matches.find((m) => m.status === "upcoming");
    if (nextMatch) {
      prematch = await getPreMatchStats(supabase, nextMatch, leaderboard.length);
    }
  } catch {}

  return NextResponse.json({
    matches,
    leaderboard,
    brief,
    revivezPosts,
    challenges: challengesForTV,
    standings: standings ?? [],
    events: events ?? [],
    ambiance,
    prematch,
  });
}
