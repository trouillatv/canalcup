// Cron hebdomadaire — génère le bilan de la semaine
// Déclencher le lundi à 8h00 NC (dimanche 21h00 UTC)

import { NextResponse } from "next/server";
import { generateTeamOfWeek } from "@/services/ai/generators/team-of-week";
import { getCostSummary } from "@/services/ai/cost-tracker";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const { getLeaderboard } = await import("@/lib/data/teams");
    const leaderboard = await getLeaderboard();
    const top = leaderboard[0];
    const bottom = leaderboard[leaderboard.length - 1];

    const context = {
      topTeam: top?.team?.name ?? "l'équipe de tête",
      topPoints: Math.round(top?.total ?? 0),
      bottomTeam: bottom && bottom.team?.id !== top?.team?.id ? (bottom.team?.name ?? "l'équipe en bas") : "l'équipe en bas",
      bottomPoints: Math.round(bottom?.total ?? 0),
      bestPrediction: "Voir les résultats dans l'application",
      worstPrediction: "Voir les pronos dans l'application",
    };

    const story = await generateTeamOfWeek(context);
    const cost = getCostSummary();

    // En prod : stocker dans revivez_posts + ai_contents
    console.log(`[CRON weekly-story] Coût session: ${cost.session_total_eur.toFixed(4)}€`);

    return NextResponse.json({ success: true, story, budget: cost });
  } catch (error) {
    console.error("[CRON weekly-story]", error);
    return NextResponse.json({ error: "Erreur génération" }, { status: 500 });
  }
}
