"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ExternalLink } from "lucide-react";
import type { PlayerCard } from "@/lib/football/player-card-types";
import { PlayerCardView, type MatchPerf } from "./PlayerCardView";

// Bottom sheet « fiche joueur » ouvert depuis le centre du match (ou ailleurs).
// Charge /api/football/players/[id] ; matchPerf (optionnel) est calculé côté
// appelant à partir des données déjà en mémoire — aucun appel API en plus.
export function PlayerSheet({
  playerId,
  matchPerf,
  onClose,
}: {
  playerId: string;
  matchPerf?: MatchPerf;
  onClose: () => void;
}) {
  const [card, setCard] = useState<PlayerCard | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetch(`/api/football/players/${playerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: PlayerCard) => { if (alive) { setCard(d); setState("ok"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, [playerId]);

  // Verrou du scroll de fond tant que le sheet est ouvert.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-canal-black border-t border-canal-gray-light rounded-t-3xl max-h-[88vh] overflow-y-auto animate-[slideUp_0.2s_ease-out]">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-canal-black/95 backdrop-blur border-b border-canal-gray-light">
          <span className="text-xs font-black text-canal-gray-muted uppercase tracking-wider">Fiche joueur</span>
          <div className="flex items-center gap-3">
            {state === "ok" && card && (
              <Link
                href={`/football/players/${playerId}`}
                className="flex items-center gap-1 text-xs font-bold text-canal-yellow hover:underline"
              >
                Fiche complète <ExternalLink size={12} />
              </Link>
            )}
            <button onClick={onClose} aria-label="Fermer" className="text-canal-gray-muted hover:text-white">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="px-4 py-4 pb-8 max-w-2xl mx-auto">
          {state === "loading" && (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {state === "error" && (
            <p className="text-center text-canal-gray-muted text-sm py-12">
              Fiche indisponible pour ce joueur.
            </p>
          )}
          {state === "ok" && card && <PlayerCardView card={card} matchPerf={matchPerf} compact />}
        </div>
      </div>
    </div>
  );
}
