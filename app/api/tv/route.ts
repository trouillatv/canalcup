import { getMatches } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { AMBIANCE_STATES } from "@/lib/tv/hype";
import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  const supabase = createAdminClient();

  const now = new Date();
  // Events window: show events from 1h ago to 24h from now
  const windowStart = new Date(now.getTime() - 60 * 60_000).toISOString();
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000).toISOString();

  const [matches, leaderboard, brief, revivezPosts, { data: standings }, { data: events }] =
    await Promise.all([
      getMatches(),
      getLeaderboard(),
      getTodayBrief(),
      getRevivezPosts(),
      supabase.from("standings").select("*").order("points", { ascending: false }),
      supabase
        .from("canal_cup_events")
        .select("*")
        .eq("is_active", true)
        .gte("starts_at", windowStart)
        .lte("starts_at", windowEnd)
        .order("starts_at", { ascending: true }),
    ]);

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

  return NextResponse.json({
    matches,
    leaderboard,
    brief,
    revivezPosts,
    standings: standings ?? [],
    events: events ?? [],
    ambiance,
  });
}
