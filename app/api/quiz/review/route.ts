// GET /api/quiz/review?session_id=... — « Revoir le quiz » (public, après la fin).
// Chaque question + bonne réponse + explication + répartition A/B/C/D + % réussite,
// et les titres automatiques. Aucune réponse individuelle exposée.
// Session non terminée → available:false (anti-spoil pendant un Live).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildQuizReview } from "@/lib/quiz/review";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = new URL(req.url).searchParams.get("session_id") ?? undefined;
  const review = await buildQuizReview(sessionId);

  return NextResponse.json(review, { headers: { "Cache-Control": "no-store" } });
}
