import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFootballProvider } from "@/lib/football";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // Get static match from DB
  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", id)
    .single();

  if (!match) return NextResponse.json({ error: "Match not found" }, { status: 404 });

  // If match has an external_id, fetch live detail from provider
  if (match.external_id) {
    const provider = getFootballProvider();
    const detail = await provider.getMatchDetail(match.external_id);
    if (detail) {
      return NextResponse.json({ match, detail }, { headers: { "Cache-Control": "s-maxage=60" } });
    }
  }

  return NextResponse.json({ match, detail: null });
}
