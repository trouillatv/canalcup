import Link from "next/link";
import type { LeaderboardRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  compact?: boolean;
}

// Modèle POINTS BRUTS : colonnes Baby + Anim = points bruts, leur somme =
// Total. Pronostics et quiz sont PERSONNELS (hors score d'équipe) ; votes =
// social. Détail complet sur la fiche équipe (lien /teams/[id]).
export function LeaderboardTable({ rows, compact }: LeaderboardTableProps) {
  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex text-xs text-canal-gray-muted px-4 py-1">
          <span className="w-8" />
          <span className="flex-1">Équipe</span>
          <span className="w-12 text-right" title="Babyfoot — points bruts">Baby</span>
          <span className="w-12 text-right" title="Animations / défis RSE — points bruts">Anim</span>
          <span className="w-14 text-right font-bold text-canal-yellow">Total</span>
        </div>
      )}

      {rows.map((row) => (
        <Link
          key={row.team.id}
          href={`/teams/${row.team.id}`}
          className={cn(
            "canal-card block hover:bg-canal-gray-mid transition-colors",
            row.rank === 1 && "border border-canal-yellow/30",
            compact && "p-3"
          )}
        >
          <div className="flex items-center">
            {/* Rank */}
            <div className="w-8 text-center font-black text-lg flex-shrink-0">
              {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
            </div>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-canal-gray-mid border border-canal-gray-light flex items-center justify-center flex-shrink-0 mr-2">
              <span className="text-sm font-black text-canal-yellow">{row.team.name[0]}</span>
            </div>

            {/* Name */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white truncate text-sm">{row.team.name}</p>
              {!compact && (
                <p className="text-xs text-canal-gray-muted italic truncate">{row.team.reputation_label}</p>
              )}
            </div>

            {!compact && (
              <>
                <span className="w-12 text-right text-sm text-white tabular-nums">
                  {row.points_babyfoot}
                </span>
                <span className="w-12 text-right text-sm text-white tabular-nums">
                  {row.points_animations}
                </span>
              </>
            )}

            <span className="w-14 text-right font-black text-canal-yellow text-lg tabular-nums">
              {row.total}
            </span>
          </div>
        </Link>
      ))}

      {!compact && (
        <p className="text-[11px] text-canal-gray-muted px-4 pt-1">
          Score d&apos;équipe = babyfoot + animations (points bruts). Pronostics
          et quiz sont personnels (hors classement d&apos;équipe). Votes = social.
        </p>
      )}
    </div>
  );
}
