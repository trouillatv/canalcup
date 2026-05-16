import { getMatches } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  const supabase = createAdminClient();
  const [matches, leaderboard, brief, revivezPosts, { data: standings }] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getTodayBrief(),
    getRevivezPosts(),
    supabase.from("standings").select("*").order("points", { ascending: false }),
  ]);
  return NextResponse.json({ matches, leaderboard, brief, revivezPosts, standings: standings ?? [] });
}
