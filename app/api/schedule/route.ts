import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, score_a, score_b, status, starts_at, phase, stage, channel")
    .in("competition", ["Coupe du Monde 2026", "FIFA World Cup 2026"])
    .order("starts_at", { ascending: true });

  return NextResponse.json(
    { matches: data ?? [] },
    { headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=15" } }
  );
}
