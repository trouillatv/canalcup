"use client";

import { useEffect, useState } from "react";

interface FactCard { type: string; emoji: string; title: string; content: string }

// 💡 Le Saviez-vous ? — 3 cartes max sur le centre du match. Données stockées/
// dérivées (0 IA à l'affichage) → instantané et stable.
export function MatchFacts({ matchId }: { matchId: string }) {
  const [cards, setCards] = useState<FactCard[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/matches/${matchId}/facts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setCards(d?.cards ?? []); })
      .catch(() => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, [matchId]);

  if (!cards || !cards.length) return null;

  return (
    <div className="mx-4 my-3">
      <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wider mb-2 px-1">💡 Le saviez-vous ?</p>
      <div className="space-y-2">
        {cards.map((c, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-canal-gray-mid border border-canal-gray-light">
            <span className="text-xl shrink-0 leading-none mt-0.5">{c.emoji}</span>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-canal-gray-muted uppercase tracking-wider">{c.title}</p>
              <p className="text-sm text-white leading-snug mt-0.5">{c.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
