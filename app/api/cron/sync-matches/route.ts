// Cron Vercel — sync API-Football fixtures + live scores.
// Schedule: 0 8 * * * (daily 8h UTC) on Hobby plan.
// Authorization: Bearer CRON_SECRET (auto-injected by Vercel).
// Logged dans public.cron_runs via runCron() (page /admin/monitoring).

import { NextResponse } from "next/server";
import { syncSeason, syncLiveScores, syncStandings, syncStandingsFromMatches } from "@/services/football";
import { settleAllFinished } from "@/services/scoring/settle";
import { runCron } from "@/lib/monitoring/cron-log";

// Snapshot du quota API-Football (1 call) — utilisé en début/fin de
// cron pour mesurer le nombre d'appels effectivement consommés.
async function apifQuotaCurrent(): Promise<number | null> {
  if (!process.env.API_FOOTBALL_KEY) return null;
  try {
    const r = await fetch("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": process.env.API_FOOTBALL_KEY },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.response?.requests?.current ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runCron("sync-matches", async () => {
    // Snapshot quota AVANT — coûte 1 call API-Football (compté dans le delta).
    const quotaBefore = await apifQuotaCurrent();

    const [seasonResult, liveSynced, providerStandings] = await Promise.all([
      syncSeason(),
      syncLiveScores(),
      syncStandings().catch(() => 0),
    ]);
    // Recalcule les classements depuis NOS matchs (à jour) — l'endpoint
    // /standings d'API-Football est parfois figé sur une journée de retard.
    // Doit passer APRÈS syncSeason/syncLiveScores (matchs frais).
    const standingsSynced = await syncStandingsFromMatches().catch(() => 0);
    const settleResult = await settleAllFinished();

    // Snapshot quota APRÈS — 1 call de plus, mais on a un delta précis.
    const quotaAfter = await apifQuotaCurrent();
    const apifCalls = quotaBefore !== null && quotaAfter !== null
      ? quotaAfter - quotaBefore
      : null;

    return {
      meta: {
        ...(typeof seasonResult === "object" ? seasonResult : {}),
        live_synced: liveSynced,
        provider_standings: providerStandings,
        standings_synced: standingsSynced,
        settled_total: settleResult.total,
        apif_calls: apifCalls,
        apif_quota_after: quotaAfter,
      },
    };
  });
}
