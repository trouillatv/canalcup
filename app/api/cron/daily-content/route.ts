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
import { getLeaderboard } from "@/lib/data/teams";
import { createAdminClient } from "@/lib/supabase/admin";

async function getRealCoachTarget() {
  try {
    const leaderboard = await getLeaderboard();
    const top = leaderboard[0];
    if (!top) return { teamName: "l'équipe Canal Cup", rank: 1, points: 0 };
    return {
      teamName: top.team?.name ?? "l'équipe Canal Cup",
      rank: 1,
      points: Math.round(top.total ?? 0),
    };
  } catch {
    return { teamName: "l'équipe Canal Cup", rank: 1, points: 0 };
  }
}

async function getRealWallOfShame() {
  try {
    const supabase = createAdminClient();
    const since = new Date(Date.now() - 72 * 60 * 60_000).toISOString();

    const { data: lastMatch } = await supabase
      .from("matches")
      .select("id, team_a, team_b, score_a, score_b")
      .eq("status", "finished")
      .not("score_a", "is", null)
      .gte("starts_at", since)
      .order("starts_at", { ascending: false })
      .limit(1)
      .single();

    if (!lastMatch) return null;

    const { data: preds } = await supabase
      .from("predictions")
      .select("team_id, predicted_score_a, predicted_score_b")
      .eq("match_id", lastMatch.id)
      .not("predicted_score_a", "is", null)
      .not("predicted_score_b", "is", null);

    if (!preds?.length) return null;

    const worst = preds
      .map((p) => ({
        ...p,
        error:
          Math.abs((p.predicted_score_a ?? 0) - lastMatch.score_a) +
          Math.abs((p.predicted_score_b ?? 0) - lastMatch.score_b),
      }))
      .sort((a, b) => b.error - a.error)[0];

    if (worst.error < 3) return null;

    let teamName = "Un concurrent courageux";
    if (worst.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", worst.team_id)
        .single();
      teamName = team?.name ?? teamName;
    }

    return {
      teamName,
      prediction: `${worst.predicted_score_a}-${worst.predicted_score_b}`,
      result: `${lastMatch.score_a}-${lastMatch.score_b}`,
    };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return runCron("daily-content", async () => {
    const [coachTarget, wallData] = await Promise.all([
      getRealCoachTarget(),
      getRealWallOfShame(),
    ]);

    const [funFact, coachComment, failCaption] = await Promise.all([
      generateFunFact([]),
      generateCoachComment(coachTarget.teamName, coachTarget.rank, coachTarget.points),
      wallData
        ? generateWallOfShameCaption(wallData.teamName, wallData.prediction, wallData.result)
        : Promise.resolve(null),
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
        coachTarget: coachTarget.teamName,
        wallTeam: wallData?.teamName ?? null,
        funFact_len: funFact?.length ?? 0,
        coachComment_len: coachComment?.length ?? 0,
        failCaption_len: failCaption?.length ?? 0,
        notified,
        ai_cost_eur: cost.session_total_eur,
      },
    };
  });
}
