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
    // En prod : récupérer depuis Supabase
    const context = {
      topTeam: "Les VARcassés",
      topPoints: 87,
      bottomTeam: "Goal Average",
      bottomPoints: 61,
      bestPrediction: "France 2-1 Brésil (exact !)",
      worstPrediction: "Allemagne 4-0 Espagne → résultat 0-0",
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
