import { getMatches } from "@/lib/data/matches";
import { getLeaderboard } from "@/lib/data/teams";
import { getTodayBrief, getRevivezPosts } from "@/lib/data/content";
import { NextResponse } from "next/server";

export const revalidate = 30;

export async function GET() {
  const [matches, leaderboard, brief, revivezPosts] = await Promise.all([
    getMatches(),
    getLeaderboard(),
    getTodayBrief(),
    getRevivezPosts(),
  ]);
  return NextResponse.json({ matches, leaderboard, brief, revivezPosts });
}
