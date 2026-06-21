"use client";

import { useState } from "react";
import type { PlayerMatchStat } from "@/services/football/types";
import { ratingPillClass } from "@/lib/football/player-card-types";
import { cn } from "@/lib/utils";

// Récap notes d'un match TERMINÉ — joueurs importants (meilleures notes) +
// les moins en vue (pires notes). Sous le score, avant les onglets. Clic →
// ouvre la fiche joueur (sheet). Données : player_match_stats déjà en mémoire.

function Pill({ p, onPlayer }: { p: PlayerMatchStat; onPlayer: (id: string, name: string) => void }) {
  const [imgOk, setImgOk] = useState(true);
  const last = p.player_name.split(" ").slice(-1).join(" ");
  const pid = p.player_id;
  const clickable = !!pid;
  const url = pid ? `https://media.api-sports.io/football/players/${pid}.png` : null;

  const inner = (
    <>
      <span className="w-6 h-6 rounded-full bg-canal-gray-light overflow-hidden flex items-center justify-center shrink-0">
        {url && imgOk ? (
          <img src={url} alt={last} className="w-full h-full object-cover" onError={() => setImgOk(false)} />
        ) : (
          <span className="text-[9px]">👤</span>
        )}
      </span>
      <span className="text-xs font-bold text-white truncate">{last}</span>
      {p.is_motm && <span className="text-[10px]">⭐</span>}
      <span className={cn("text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded", ratingPillClass(p.rating))}>
        {p.rating != null ? p.rating.toFixed(1) : "—"}
      </span>
    </>
  );
  const cls = "flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full bg-canal-gray-mid";
  if (!clickable) return <span className={cls}>{inner}</span>;
  return (
    <button onClick={() => onPlayer(pid!, p.player_name)} className={cn(cls, "hover:bg-canal-gray-light transition-colors")}>
      {inner}
    </button>
  );
}

export function MatchRatingsRecap({
  playerStats,
  onPlayer,
}: {
  playerStats: PlayerMatchStat[];
  onPlayer: (id: string, name: string) => void;
}) {
  const rated = playerStats.filter((p) => p.rating != null);
  if (rated.length < 4) return null;

  const sorted = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const best = sorted.slice(0, 3);
  // « Les moins en vue » seulement s'il y a assez de joueurs notés (sinon
  // chevauchement avec le top) → on évite d'afficher un même joueur 2 fois.
  const worst = rated.length >= 6 ? sorted.slice(-3).reverse() : [];

  return (
    <div className="mx-4 my-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-canal-gray-mid to-canal-gray border border-canal-yellow/20 space-y-2.5">
      <div>
        <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wider mb-1.5">⭐ Joueurs du match</p>
        <div className="flex flex-wrap gap-1.5">
          {best.map((p, i) => <Pill key={`b${i}`} p={p} onPlayer={onPlayer} />)}
        </div>
      </div>
      {worst.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-canal-gray-muted uppercase tracking-wider mb-1.5">😬 Les moins en vue</p>
          <div className="flex flex-wrap gap-1.5">
            {worst.map((p, i) => <Pill key={`w${i}`} p={p} onPlayer={onPlayer} />)}
          </div>
        </div>
      )}
    </div>
  );
}
