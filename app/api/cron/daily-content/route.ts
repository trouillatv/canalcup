// Cron quotidien — génère : fail du jour, fun fact, coach comment, wall of shame
// Déclencher à 23h30 NC (12h30 UTC) après les matchs du soir

import { NextResponse } from "next/server";
import { generateFunFact } from "@/services/ai/generators/fun-fact";
import { generateCoachComment } from "@/services/ai/generators/coach";
import { generateWallOfShameCaption } from "@/services/ai/generators/wall-of-shame";
import { getCostSummary } from "@/services/ai/cost-tracker";
import { broadcastInboxEvent, wasBroadcastToday } from "@/lib/data/inbox";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    // Générer en parallèle pour minimiser le temps de réponse
    const [funFact, coachComment, failCaption] = await Promise.all([
      generateFunFact([]),
      generateCoachComment("Les VARcassés", 1, 87), // À récupérer dynamiquement
      generateWallOfShameCaption("FC Réunion Inutile", "Nul 1-1", "France 2-1"),
    ]);

    // En prod : stocker dans Supabase ai_contents + revivez_posts
    const results = { funFact, coachComment, failCaption };

    // Producteur inbox : 1 courrier 'roast' (mot du coach) par utilisateur.
    // Ce cron n'a pas d'idempotence propre → garde anti-doublon explicite.
    // Dormant tant que ce cron n'est pas planifié + MOCK_AI=false.
    let notified = 0;
    if (!(await wasBroadcastToday("roast"))) {
      notified = await broadcastInboxEvent({
        type: "roast",
        title: "Le coach a parlé 🎙️",
        message: coachComment,
      });
    }

    const cost = getCostSummary();

    console.log(`[CRON daily-content] Coût session: ${cost.session_total_eur.toFixed(4)}€`);

    return NextResponse.json({ success: true, results, notified, budget: cost });
  } catch (error) {
    console.error("[CRON daily-content]", error);
    return NextResponse.json({ error: "Erreur génération" }, { status: 500 });
  }
}
