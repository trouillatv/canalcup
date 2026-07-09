"use client";

// Classement compact de l'accueil — onglets Joueurs (par défaut) / Équipe.
// Réutilise LeaderboardTable (compact) pour les binômes et une petite liste
// pour les joueurs (métrique "général" = tous points confondus).

import { useState } from "react";
import Link from "next/link";
import { track } from "@/lib/analytics/track";
import { LeaderboardTable } from "./LeaderboardTable";
import type { LeaderboardRow } from "@/lib/supabase/types";
import type { IndividualRow } from "@/lib/data/teams";

type Tab = "players" | "teams";

function medal(rank: number) {
  return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : String(rank);
}

export function HomeLeaderboard({
  teamRows,
  individualRows,
  limit = 5,
}: {
  teamRows: LeaderboardRow[];
  individualRows: IndividualRow[];
  limit?: number;
}) {
  const [tab, setTab] = useState<Tab>("players");
  const players = [...individualRows].sort((a, b) => b.total - a.total).slice(0, limit);
  const teams = [...teamRows].sort((a, b) => b.total - a.total).slice(0, limit);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {([
          { id: "players", label: "🧍 Joueurs" },
          { id: "teams", label: "👥 Équipe" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); track(`/#classement-${t.id}`); }}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              tab === t.id ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "players" ? (
        <div className="space-y-2">
          {players.map((r, i) => {
            const rank = i + 1;
            return (
              <Link
                key={r.user_id}
                href={`/joueur/${r.user_id}`}
                className={`canal-card p-3 flex items-center hover:bg-canal-gray-mid transition-colors ${rank === 1 ? "border border-canal-yellow/30" : ""}`}
              >
                <div className="w-8 text-center font-black text-lg flex-shrink-0">{medal(rank)}</div>
                <div className="flex-1 min-w-0 ml-1">
                  <p className="font-bold text-white truncate text-sm">{r.display_name ?? "Anonyme"}</p>
                  <p className="text-[11px] text-canal-gray-muted truncate">{r.team_name ?? "Sans binôme"}</p>
                </div>
                <span className="font-black text-canal-yellow text-lg tabular-nums shrink-0">{r.total}</span>
              </Link>
            );
          })}
          {players.length === 0 && (
            <div className="canal-card text-center py-6 text-canal-gray-muted text-sm">Personne ici pour l&apos;instant.</div>
          )}
        </div>
      ) : (
        <LeaderboardTable rows={teams} compact />
      )}
    </div>
  );
}
