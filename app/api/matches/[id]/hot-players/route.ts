import { NextResponse } from "next/server";
import { getMatchHotPlayers } from "@/lib/football/player-insights";

// Joueurs chauds / froids d'un match (Indice Dangerosité sur la forme récente).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await getMatchHotPlayers(id);
  return NextResponse.json(data);
}
