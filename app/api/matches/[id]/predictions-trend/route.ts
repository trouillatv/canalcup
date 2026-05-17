// GET /api/matches/[id]/predictions-trend
// Tendances pronostics Canal Cup pour un match : répartition 1/N/2,
// nombre de scores exacts (si match fini). Agrégat anonyme — aucun nom.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: match } = await supabase
    .from("matches")
    .select("status, score_a, score_b")
    .eq("id", id)
    .single();

  const { data: preds } = await supabase
    .from("predictions")
    .select("prediction_result, predicted_score_a, predicted_score_b")
    .eq("match_id", id);

  const rows = preds ?? [];
  const total = rows.length;
  const a = rows.filter((p) => p.prediction_result === "A").length;
  const draw = rows.filter((p) => p.prediction_result === "DRAW").length;
  const b = rows.filter((p) => p.prediction_result === "B").length;

  const finished = match?.status === "finished";
  const exact =
    finished && match
      ? rows.filter(
          (p) =>
            p.predicted_score_a === match.score_a &&
            p.predicted_score_b === match.score_b
        ).length
      : null;

  return NextResponse.json(
    { total, a, draw, b, exact, finished },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" } }
  );
}
