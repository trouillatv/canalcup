import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatchDetail } from "@/services/football";
import { dedupe } from "@/services/football/polling";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Verify match exists and user has access
  const { data: match } = await supabase
    .from("matches")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Deduplicate concurrent requests for the same match
  const detail = await dedupe(`api:match:${id}`, () => getMatchDetail(id));

  if (!detail) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  const ttl = match.status === "live" ? 30 : match.status === "finished" ? 3600 : 300;
  return NextResponse.json(detail, {
    headers: { "Cache-Control": `s-maxage=${ttl}, stale-while-revalidate=10` },
  });
}
