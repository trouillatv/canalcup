import { NextResponse } from "next/server";
import { getTopForm } from "@/lib/football/player-insights";

// Classement des joueurs les plus en forme (note moyenne récente).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "15", 10) || 15);
  // worldCupOnly : on exclut les matchs test/hors-CdM des stats joueurs.
  const players = await getTopForm({ limit, worldCupOnly: true });
  return NextResponse.json({ players });
}
