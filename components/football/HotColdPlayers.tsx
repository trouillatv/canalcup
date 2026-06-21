"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { RankedPlayer } from "@/lib/football/player-card-types";

// 👀 Joueurs à surveiller — chauds / froids d'un match (Indice Dangerosité sur
// la forme récente). Clic → ouvre la fiche joueur (sheet) via onPlayer.
function dangerColor(d: number): string {
  if (d >= 85) return "bg-red-500/20 text-red-400 border border-red-500/40";
  if (d >= 60) return "bg-orange-500/20 text-orange-400 border border-orange-500/40";
  return "bg-canal-gray-light text-canal-gray-muted";
}

const POS_ABBR: Record<string, string> = { Gardien: "GB", Défenseur: "DEF", Milieu: "MIL", Attaquant: "ATT" };

function PlayerPill({ p, onPlayer }: { p: RankedPlayer; onPlayer: (id: string, name: string) => void }) {
  const [imgOk, setImgOk] = useState(true);
  const last = p.name.split(" ").slice(-1).join(" ");
  const meta = [p.positionFr ? (POS_ABBR[p.positionFr] ?? p.positionFr) : null, p.teamName].filter(Boolean).join(" · ");
  return (
    <button
      onClick={() => onPlayer(p.id, p.name)}
      className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-full bg-canal-gray-mid hover:bg-canal-gray-light transition-colors max-w-full"
    >
      <span className="w-7 h-7 rounded-full bg-canal-gray-light overflow-hidden flex items-center justify-center shrink-0">
        {imgOk ? (
          <img src={p.photo} alt={p.name} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
        ) : (
          <span className="text-[9px]">👤</span>
        )}
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className="block text-xs font-bold text-white truncate">{last}</span>
        {meta && <span className="block text-[9px] text-canal-gray-muted truncate">{meta}</span>}
      </span>
      {p.danger != null && (
        <span className={cn("text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded shrink-0", dangerColor(p.danger))}>{p.danger}</span>
      )}
    </button>
  );
}

export function HotColdPlayers({ matchId, onPlayer }: { matchId: string; onPlayer: (id: string, name: string) => void }) {
  const [data, setData] = useState<{ hot: RankedPlayer[]; cold: RankedPlayer[] } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/matches/${matchId}/hot-players`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setData(d); })
      .catch(() => {});
    return () => { alive = false; };
  }, [matchId]);

  if (!data || (!data.hot.length && !data.cold.length)) return null;

  return (
    <div className="mx-4 my-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-canal-gray-mid to-canal-gray border border-canal-yellow/20 space-y-2.5">
      {data.hot.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wider mb-1.5">🔥 Joueurs à surveiller</p>
          <div className="flex flex-wrap gap-1.5">
            {data.hot.map((p) => <PlayerPill key={p.id} p={p} onPlayer={onPlayer} />)}
          </div>
        </div>
      )}
      {data.cold.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-canal-gray-muted uppercase tracking-wider mb-1.5">😴 En manque de forme</p>
          <div className="flex flex-wrap gap-1.5">
            {data.cold.map((p) => <PlayerPill key={p.id} p={p} onPlayer={onPlayer} />)}
          </div>
        </div>
      )}
    </div>
  );
}
