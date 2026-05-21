// Cron Vercel — sync TheSportsDB / API-Football fixtures + live scores.
// Schedule: 0 8 * * * (daily 8h UTC) on Hobby plan.
// Authorization: Bearer CRON_SECRET (auto-injected by Vercel).
// Logged dans public.cron_runs via runCron() (page /admin/monitoring).

import { NextResponse } from "next/server";
import { syncSeason, syncLiveScores, syncStandings } from "@/services/football";
import { settleAllFinished } from "@/services/scoring/settle";
import { runCron } from "@/lib/monitoring/cron-log";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCron("sync-matches", async () => {
    const [seasonResult, liveSynced, standingsSynced] = await Promise.all([
      syncSeason(),
      syncLiveScores(),
      syncStandings(),
    ]);
    const settleResult = await settleAllFinished();
    return {
      meta: {
        ...(typeof seasonResult === "object" ? seasonResult : {}),
        live_synced: liveSynced,
        standings_synced: standingsSynced,
        settled_total: settleResult.total,
      },
    };
  });
}
