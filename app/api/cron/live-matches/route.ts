// Endpoint sync LIVE — conçu pour être appelé FRÉQUEMMENT (toutes les 1–5 min)
// pendant les matchs, par un cron / pinger externe ou la boucle locale
// scripts/auto-live.js. Couvre les matchs de la Coupe du Monde (ligue 1) ;
// le match test "amical" passe lui par scripts/watch-match.js (hors ligue 1).
//
// GARDE-FOU QUOTA (≤ 7500 req/jour API-Football) : on lit d'abord Supabase
// (gratuit) pour vérifier qu'un match est bien dans sa fenêtre live MAINTENANT.
// Hors fenêtre → retour immédiat, 0 appel API-Football, 0 ligne cron_runs
// (sinon le monitoring serait noyé par les pings à vide).
//
// Auth : Bearer CRON_SECRET (auto-injecté par Vercel ; à fournir aussi par un
// pinger externe). Vérifié en production uniquement.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncLiveScores } from "@/services/football";
import { settleAllFinished } from "@/services/scoring/settle";
import { runCron } from "@/lib/monitoring/cron-log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fenêtre live = [coup d'envoi − 5 min, coup d'envoi + 180 min] et pas encore
  // "terminé". 180 min couvre prolongations + tirs au but d'un match à élim.
  const supabase = createAdminClient();
  const now = Date.now();
  const lower = new Date(now - 180 * 60_000).toISOString();
  const upper = new Date(now + 5 * 60_000).toISOString();
  const { data: windowMatches } = await supabase
    .from("matches")
    .select("id")
    .neq("status", "finished")
    .gte("starts_at", lower)
    .lte("starts_at", upper)
    .limit(1);

  if (!windowMatches || windowMatches.length === 0) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_live_window", apif_calls: 0 });
  }

  return runCron("live-matches", async () => {
    const liveSynced = await syncLiveScores();
    const settleResult = await settleAllFinished();
    return { meta: { live_synced: liveSynced, settled_total: settleResult.total } };
  });
}
