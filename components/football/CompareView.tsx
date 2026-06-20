"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import type { PlayerCard } from "@/lib/football/player-card-types";

function PlayerHead({ card }: { card: PlayerCard }) {
  const [imgOk, setImgOk] = useState(true);
  const url = card.bio?.photo ?? `https://media.api-sports.io/football/players/${card.id}.png`;
  const name = card.bio?.name ?? card.meta?.teamName ?? `#${card.id}`;
  return (
    <Link href={`/football/players/${card.id}`} className="flex-1 flex flex-col items-center gap-1 min-w-0">
      <span className="w-16 h-16 rounded-full bg-canal-gray-mid border-2 border-white/80 overflow-hidden flex items-center justify-center">
        {imgOk ? (
          <img src={url} alt={name} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
        ) : (
          <span className="text-white font-black">{card.meta?.number ?? "?"}</span>
        )}
      </span>
      <span className="text-sm font-black text-white text-center leading-tight truncate max-w-full">{name}</span>
      {card.meta?.teamName && <span className="text-[11px] text-canal-gray-muted truncate max-w-full">{card.meta.teamName}</span>}
    </Link>
  );
}

type Row = { label: string; a: number | null; b: number | null; fmt?: (n: number) => string; higherBetter?: boolean };

export function CompareView({ a, b }: { a: PlayerCard; b: PlayerCard }) {
  const rows: Row[] = [
    { label: "Indice Dangerosité", a: a.danger?.score ?? null, b: b.danger?.score ?? null },
    { label: "Note (forme)", a: a.formAvg, b: b.formAvg, fmt: (n) => n.toFixed(2) },
    { label: "Note (Mondial)", a: a.wc.avgRating, b: b.wc.avgRating, fmt: (n) => n.toFixed(2) },
    { label: "Matchs", a: a.wc.matches, b: b.wc.matches },
    { label: "Minutes", a: a.wc.minutes, b: b.wc.minutes },
    { label: "Buts", a: a.wc.goals, b: b.wc.goals },
    { label: "Passes D", a: a.wc.assists, b: b.wc.assists },
    { label: "Cartons 🟨", a: a.wc.yellowCards, b: b.wc.yellowCards, higherBetter: false },
  ];

  return (
    <div className="space-y-4">
      <Link href={`/football/players/${a.id}`} className="flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm font-bold">
        <ArrowLeft size={16} /> Fermer la comparaison
      </Link>

      <div className="flex items-start gap-2">
        <PlayerHead card={a} />
        <span className="text-canal-yellow font-black text-lg pt-5">VS</span>
        <PlayerHead card={b} />
      </div>

      <div className="rounded-2xl bg-canal-gray-mid/60 border border-canal-gray-light overflow-hidden divide-y divide-canal-gray-light">
        {rows.map((r) => {
          const higherBetter = r.higherBetter !== false;
          const av = r.a, bv = r.b;
          let aWins = false, bWins = false;
          if (av != null && bv != null && av !== bv) {
            const aBetter = higherBetter ? av > bv : av < bv;
            aWins = aBetter; bWins = !aBetter;
          }
          const show = (n: number | null) => (n == null ? "—" : r.fmt ? r.fmt(n) : String(n));
          return (
            <div key={r.label} className="flex items-center text-sm">
              <span className={cn("flex-1 text-center font-black tabular-nums py-2.5", aWins ? "text-canal-yellow" : "text-white")}>{show(av)}</span>
              <span className="w-28 text-center text-[11px] text-canal-gray-muted uppercase tracking-wider shrink-0">{r.label}</span>
              <span className={cn("flex-1 text-center font-black tabular-nums py-2.5", bWins ? "text-canal-yellow" : "text-white")}>{show(bv)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-canal-gray-muted text-center italic">
        Stats Mondial/forme issues de nos données — en jaune le meilleur des deux.
      </p>
    </div>
  );
}
