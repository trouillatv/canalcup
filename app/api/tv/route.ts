import { getMatches, getGroupStandings } from "@/lib/data/matches";
import { getLeaderboard, getIndividualLeaderboard } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { computeMedals } from "@/lib/data/medals";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { getChallenges } from "@/lib/data/challenges";
import { getTvPredictionHeatmap } from "@/lib/data/player";
import { getAdminEmails } from "@/lib/data/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { AMBIANCE_STATES } from "@/lib/tv/hype";
import { NextResponse } from "next/server";
import type { Match } from "@/lib/supabase/types";

export const revalidate = 30;

// ─── Fil L'Équipe (RSS) ──────────────────────────────────────────────────────
// Fetch serveur du flux RSS de L'Équipe (timeout court). On NE scrape PAS le HTML
// ni n'iframe (X-Frame-Options: sameorigin) — uniquement le RSS.
async function getLequipeNews(): Promise<{ title: string; link: string }[]> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch("https://dwh.lequipe.fr/api/edito/rss", {
      signal: ctrl.signal,
      headers: { "User-Agent": "CanalCupTV/1.0" },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const xml = await res.text();

    const clean = (s: string) =>
      s
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .trim();

    const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
    const news: { title: string; link: string }[] = [];
    for (const item of items) {
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1];
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1];
      if (title) {
        news.push({ title: clean(title), link: link ? clean(link) : "" });
      }
      if (news.length >= 8) break;
    }
    return news;
  } catch {
    return [];
  }
}


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

// Compteurs du jour (created_at >= début du jour UTC) : pronos, quiz, défis.
async function getTodayStats(supabase: ReturnType<typeof createAdminClient>) {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const since = dayStart.toISOString();

  const countSince = async (table: string) => {
    try {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .gte("created_at", since);
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  const [pronos, quiz, animations] = await Promise.all([
    countSince("predictions"),
    countSince("quiz_answers"),
    countSince("challenge_entries"),
  ]);
  return { pronos, quiz, animations };
}

// Nouveaux joueurs (profil complété, < 48h, non admins). On renvoie les
// display_name uniquement — jamais les emails.
async function getNewPlayers(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
    const [{ data }, adminEmails] = await Promise.all([
      supabase
        .from("users")
        .select("display_name, email, created_at")
        .eq("profile_completed", true)
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      getAdminEmails(),
    ]);
    return (data ?? [])
      .filter((u: { email: string | null }) => !adminEmails.has((u.email ?? "").toLowerCase()))
      .map((u: { display_name: string | null }) => u.display_name)
      .filter((n): n is string => !!n && n.trim().length > 0);
  } catch {
    return [];
  }
}

// Buteurs les plus pariés (bonus_predictions top_scorer), top 6, tri desc.
async function getTopScorerBets(
  supabase: ReturnType<typeof createAdminClient>
): Promise<{ name: string; count: number }[]> {
  try {
    const { data } = await supabase
      .from("bonus_predictions")
      .select("predicted_value")
      .eq("prediction_type", "top_scorer");
    const counts: Record<string, number> = {};
    for (const b of data ?? []) {
      const v = (b.predicted_value ?? "").trim();
      if (v) counts[v] = (counts[v] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  } catch {
    return [];
  }
}

export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  // Events window: show events from 1h ago to 24h from now
  const windowStart = new Date(now.getTime() - 60 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();

  const [matches, leaderboard, individual, services, medals, brief, revivezPosts, allChallenges, news, todayStats, newPlayers, topScorerBets, heatmap, standings, { data: events }] =
    await Promise.all([
      getMatches(),
      getLeaderboard(),
      getIndividualLeaderboard(),
      getServiceLeaderboard(),
      computeMedals(),
      getTodayBrief(),
      getRevivezPosts(),
      getChallenges(),
      getLequipeNews(),
      getTodayStats(supabase),
      getNewPlayers(supabase),
      getTopScorerBets(supabase),
      getTvPredictionHeatmap().catch(() => []),
      getGroupStandings(),
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
    individual,
    services,
    medals,
    brief,
    revivezPosts,
    challenges: challengesForTV,
    news,
    standings: standings ?? [],
    events: events ?? [],
    ambiance,
    prematch,
    todayStats,
    newPlayers,
    topScorerBets,
    heatmap,
  });
}
