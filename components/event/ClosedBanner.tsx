"use client";

// Bandeau global affiché sur TOUTES les pages Canal Cup quand la Canal Cup
// est terminée.
//
// Rôle : expliquer, partout, pourquoi les boutons de jeu ont disparu. Sans lui,
// un joueur qui arrive sur /pronostics croit à un bug. Discret mais permanent,
// et il ramène toujours au palmarès. Masqué sur /cs/* : ce statut de clôture
// est propre à Canal Cup, sans rapport avec CANAL Sports.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, ChevronRight } from "lucide-react";

export function ClosedBanner() {
  const pathname = usePathname() || "/";
  if (pathname === "/cs" || pathname.startsWith("/cs/")) return null;

  return (
    <Link
      href="/final"
      className="block bg-canal-yellow/10 border-b border-canal-yellow/30 px-4 py-2 hover:bg-canal-yellow/15 transition-colors"
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto">
        <Trophy className="w-4 h-4 text-canal-yellow shrink-0" />
        <p className="text-xs sm:text-sm text-white/90 flex-1 leading-snug">
          <span className="font-bold text-canal-yellow">Canal Cup 2026 terminée</span>
          <span className="text-canal-gray-muted"> — les résultats sont définitifs.</span>
        </p>
        <span className="text-xs font-semibold text-canal-yellow whitespace-nowrap flex items-center gap-0.5">
          Palmarès
          <ChevronRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
