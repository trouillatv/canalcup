// Cron Vercel — sync TheSportsDB fixtures + live scores
// Schedule: 0 8 * * * (daily 8h UTC) on Hobby plan
// Authorization: Bearer CRON_SECRET (auto-injected by Vercel)

import { NextResponse } from "next/server";
import { syncSeason, syncLiveScores, syncStandings } from "@/services/football";
import { settleAllFinished } from "@/services/scoring/settle";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Sync scores first, then settle finished matches
  const [seasonResult, liveSynced, standingsSynced] = await Promise.all([
    syncSeason(),
    syncLiveScores(),
    syncStandings(),
  ]);

  const settleResult = await settleAllFinished();

  console.log(`[cron/sync-matches] season=${JSON.stringify(seasonResult)} live=${liveSynced} standings=${standingsSynced} settled=${settleResult.total}`);
  return NextResponse.json({ ok: true, ...seasonResult, live_synced: liveSynced, standings_synced: standingsSynced, settled: settleResult });
}
