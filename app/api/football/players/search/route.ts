import { NextResponse } from "next/server";
import { searchPlayers } from "@/lib/football/player-card";

// Recherche de joueurs (comparateur). Sur wc-teams.json, aucune DB/API.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return NextResponse.json({ players: searchPlayers(q) });
}
