// Manual sync endpoint — POST /api/admin/sync-matches
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { syncSeason, syncScheduleTsdb, syncLiveScores, syncStandings } from "@/services/football";
import { settleAllFinished } from "@/services/scoring/settle";

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
  // Fallback TheSportsDB (voir cron) : crée les matchs de phase finale absents
  // d'API-Football (plan gratuit sans accès 2026), puis règle les matchs finis.
  const scheduleTsdb = await syncScheduleTsdb().catch(() => ({ inserted: 0, updated: 0 }));
  const settleResult = await settleAllFinished();

  return NextResponse.json({
    ok: true, ...seasonResult,
    tsdb_inserted: scheduleTsdb.inserted, tsdb_updated: scheduleTsdb.updated,
    live_synced: liveSynced, standings_synced: standingsSynced, settled_total: settleResult.total,
  });
}
