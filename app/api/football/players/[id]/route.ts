import { NextResponse } from "next/server";
import { getPlayerCard } from "@/lib/football/player-card";

// Fiche joueur football — données pour le bottom sheet (client) et tout
// consommateur. id = api_football_id.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "id invalide" }, { status: 400 });
  }
  const card = await getPlayerCard(id);
  if (card.notFound) {
    return NextResponse.json({ error: "Joueur introuvable" }, { status: 404 });
  }
  return NextResponse.json(card);
}
