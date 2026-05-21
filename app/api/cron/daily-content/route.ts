// Cron quotidien — génère : fail du jour, fun fact, coach comment, wall of shame.
// Déclencher à 23h30 NC (12h30 UTC) après les matchs du soir.
// Logged dans public.cron_runs via runCron() (page /admin/monitoring).

import { NextResponse } from "next/server";
import { generateFunFact } from "@/services/ai/generators/fun-fact";
import { generateCoachComment } from "@/services/ai/generators/coach";
import { generateWallOfShameCaption } from "@/services/ai/generators/wall-of-shame";
import { getCostSummary } from "@/services/ai/cost-tracker";
import { broadcastInboxEvent, wasBroadcastToday } from "@/lib/data/inbox";
import { runCron } from "@/lib/monitoring/cron-log";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return runCron("daily-content", async () => {
    const [funFact, coachComment, failCaption] = await Promise.all([
      generateFunFact([]),
      generateCoachComment("Les VARcassés", 1, 87),
      generateWallOfShameCaption("FC Réunion Inutile", "Nul 1-1", "France 2-1"),
    ]);

    let notified = 0;
    if (!(await wasBroadcastToday("roast"))) {
      notified = await broadcastInboxEvent({
        type: "roast",
        title: "Le coach a parlé 🎙️",
        message: coachComment,
      });
    }

    const cost = getCostSummary();
    return {
      meta: {
        funFact_len: funFact?.length ?? 0,
        coachComment_len: coachComment?.length ?? 0,
        failCaption_len: failCaption?.length ?? 0,
        notified,
        ai_cost_eur: cost.session_total_eur,
      },
    };
  });
}
