"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { RankedPlayer } from "@/lib/football/player-card-types";
import { ratingPillClass } from "@/lib/football/player-card-types";
import { ChevronDown } from "lucide-react";

// 🔥 Les plus en forme du Mondial — surface de découverte (clic → autre fiche).
// Repliée par défaut sur la fiche pour ne pas alourdir ; charge à l'ouverture.
export function TopFormList({ currentId, defaultOpen = false }: { currentId?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [players, setPlayers] = useState<RankedPlayer[] | null>(null);

  useEffect(() => {
    if (!open || players) return;
    fetch("/api/football/top-form?limit=15")
      .then((r) => r.json())
      .then((d) => setPlayers(d.players ?? []))
      .catch(() => setPlayers([]));
  }, [open, players]);

  return (
    <div className="rounded-2xl bg-canal-gray-mid/60 border border-canal-gray-light overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="text-[11px] font-black text-canal-yellow uppercase tracking-wider">🔥 Les plus en forme</span>
        <ChevronDown size={16} className={cn("text-canal-gray-muted transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
          {players == null && <p className="text-center text-canal-gray-muted text-xs py-4">Chargement…</p>}
          {players && !players.length && <p className="text-center text-canal-gray-muted text-xs py-4">Pas encore assez de données.</p>}
          {players?.map((p, i) => (
            <Link
              key={p.id}
              href={`/football/players/${p.id}`}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors",
                p.id === currentId ? "bg-canal-yellow/10" : "bg-canal-gray-mid hover:bg-canal-gray-light"
              )}
            >
              <span className="w-5 text-center text-xs font-black text-canal-gray-muted tabular-nums">{i + 1}</span>
              <img src={p.photo} alt={p.name} className="w-7 h-7 rounded-full object-cover bg-canal-gray-light" />
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-bold text-white truncate">{p.name}</span>
                {p.teamName && <span className="block text-[10px] text-canal-gray-muted truncate">{p.teamName}</span>}
              </span>
              <span className={cn("text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0", ratingPillClass(p.avgRating))}>
                {p.avgRating != null ? p.avgRating.toFixed(2) : "—"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
