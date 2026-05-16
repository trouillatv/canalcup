import { NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMatchDetail } from "@/services/football";
import { dedupe } from "@/services/football/polling";
import { settleMatch } from "@/services/scoring/settle";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: match } = await supabase
    .from("matches")
    .select("id, status, is_settled")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Deduplicate concurrent requests for the same match
  const detail = await dedupe(`api:match:${id}`, () => getMatchDetail(id));

  if (!detail) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // Settle this match in background if it just finished
  if (match.status === "finished" && !match.is_settled) {
    after(() => settleMatch(id));
  }

  const ttl = match.status === "live" ? 30 : match.status === "finished" ? 3600 : 300;
  return NextResponse.json(detail, {
    headers: { "Cache-Control": `s-maxage=${ttl}, stale-while-revalidate=10` },
  });
}
