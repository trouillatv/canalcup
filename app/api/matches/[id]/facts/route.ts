import { NextResponse } from "next/server";
import { getMatchFacts } from "@/lib/football/match-facts";

// « Le Saviez-vous ? » d'un match — 3 cartes max, données stockées/dérivées (0 IA).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cards = await getMatchFacts(id);
  // Cache : la carte Canal Cup bouge en live, le reste est stable.
  return NextResponse.json(
    { cards },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" } }
  );
}
