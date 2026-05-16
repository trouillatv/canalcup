// Cron quotidien — génère la matinale et la stocke en base
// Déclencher à 6h00 NC (19h00 UTC la veille)
// Vercel Cron : "0 19 * * *" ou appel manuel depuis l'admin

import { NextResponse } from "next/server";
import { generateMorningBrief } from "@/services/ai/generators/morning-brief";

export async function GET(request: Request) {
  // Sécurité : vérifier le header Vercel Cron ou une clé secrète
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Données contextuelles — en prod, récupérer depuis Supabase
    const context = {
      date: today,
      scores: "À récupérer depuis les matchs de la veille",
      leaderboard: "À récupérer depuis le classement actuel",
      failTeam: "À récupérer depuis les pronostics ratés",
      matchTonight: "À récupérer depuis le match du jour",
    };

    const brief = await generateMorningBrief(context);

    // En prod : insérer dans Supabase morning_briefs
    // const supabase = await createClient();
    // await supabase.from("morning_briefs").upsert({ date: today, ...brief });

    return NextResponse.json({ success: true, date: today, brief });
  } catch (error) {
    console.error("[CRON morning-brief]", error);
    return NextResponse.json({ error: "Erreur génération" }, { status: 500 });
  }
}
