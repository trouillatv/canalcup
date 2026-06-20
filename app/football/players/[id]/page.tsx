// /football/players/[id] — fiche JOUEUR DE FOOTBALL réel (≠ /joueur/[id] qui est
// la fiche participant Canal Cup). id = api_football_id.
// Mix Sofascore + Transfermarkt + Football Manager, recadré sur nos données :
// header (bio + club + valeur), Indice Dangerosité, onglets Forme / Mondial.

import { notFound } from "next/navigation";
import { getPlayerCard } from "@/lib/football/player-card";
import { PlayerCardView } from "@/components/football/PlayerCardView";
import { CompareView } from "@/components/football/CompareView";
import { BackButton } from "@/components/football/BackButton";

export const dynamic = "force-dynamic";

export default async function FootballPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vs?: string }>;
}) {
  const { id } = await params;
  const { vs } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();

  const card = await getPlayerCard(id);
  if (card.notFound) notFound();

  // Mode comparateur : /football/players/[id]?vs=[autre]
  const cardB = vs && /^\d+$/.test(vs) ? await getPlayerCard(vs) : null;
  const compare = cardB && !cardB.notFound ? cardB : null;

  return (
    <div className="min-h-screen bg-canal-black">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 bg-canal-black/95 backdrop-blur border-b border-canal-gray-light">
        <BackButton />
      </div>
      <div className="px-4 py-4 pb-12 max-w-2xl mx-auto">
        {compare ? <CompareView a={card} b={compare} /> : <PlayerCardView card={card} showExtras />}
      </div>
    </div>
  );
}
