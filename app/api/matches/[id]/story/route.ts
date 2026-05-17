import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("match_stories")
    .select("phrase, stats_json, created_at")
    .eq("match_id", id)
    .single();

  if (!data) return NextResponse.json({ story: null });

  return NextResponse.json(
    { story: { phrase: data.phrase, stats: data.stats_json, created_at: data.created_at } },
    { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } }
  );
}
