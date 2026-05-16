// Cron Vercel — sync TheSportsDB fixtures + live scores
// Schedule: 0 8 * * * (daily 8h UTC) on Hobby plan
// Authorization: Bearer CRON_SECRET (auto-injected by Vercel)

import { NextResponse } from "next/server";
import { syncSeason, syncLiveScores } from "@/services/football";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [seasonResult, liveSynced] = await Promise.all([
    syncSeason(),
    syncLiveScores(),
  ]);

  console.log(`[cron/sync-matches] season=${JSON.stringify(seasonResult)} live=${liveSynced}`);
  return NextResponse.json({ ok: true, ...seasonResult, live_synced: liveSynced });
}
