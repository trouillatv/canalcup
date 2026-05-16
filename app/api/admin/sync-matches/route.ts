// Manual sync endpoint — POST /api/admin/sync-matches
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { syncSeason, syncLiveScores, syncStandings } from "@/services/football";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [seasonResult, liveSynced, standingsSynced] = await Promise.all([
    syncSeason(),
    syncLiveScores(),
    syncStandings(),
  ]);

  return NextResponse.json({ ok: true, ...seasonResult, live_synced: liveSynced, standings_synced: standingsSynced });
}
