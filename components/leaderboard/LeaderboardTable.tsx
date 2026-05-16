import type { LeaderboardRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface LeaderboardTableProps {
  rows: LeaderboardRow[];
  compact?: boolean;
}

export function LeaderboardTable({ rows, compact }: LeaderboardTableProps) {
  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex text-xs text-canal-gray-muted px-4 py-1">
          <span className="w-8" />
          <span className="flex-1">Équipe</span>
          <span className="w-12 text-right">Pronos</span>
          <span className="w-10 text-right">Bonus</span>
          <span className="w-10 text-right">Quiz</span>
          <span className="w-10 text-right">Baby</span>
          <span className="w-14 text-right font-bold text-canal-yellow">Total</span>
        </div>
      )}

      {rows.map((row) => (
        <div
          key={row.team.id}
          className={cn(
            "canal-card",
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
                <span className="w-12 text-right text-sm text-white">{row.points_predictions}</span>
                <span className="w-10 text-right text-sm text-white">{row.points_bonus ?? 0}</span>
                <span className="w-10 text-right text-sm text-white">{row.points_quiz}</span>
                <span className="w-10 text-right text-sm text-white">{row.points_babyfoot}</span>
              </>
            )}

            <span className="w-14 text-right font-black text-canal-yellow text-lg">
              {row.total}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
