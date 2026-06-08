import Link from "next/link";
import type { Team } from "@/lib/supabase/types";

import { ChevronRight, Clock } from "lucide-react";

interface TeamCardProps {
  team: Team;
  rank?: number;
  showDetails?: boolean;
  hasPendingRequest?: boolean;
  pendingCount?: number;
}

const TEAM_COLORS = [
  "border-l-canal-yellow",
  "border-l-white/60",
  "border-l-yellow-700",
];

export function TeamCard({ team, rank, showDetails, hasPendingRequest, pendingCount = 0 }: TeamCardProps) {
  const borderColor = rank ? TEAM_COLORS[(rank - 1) % 3] : "border-l-canal-gray-light";

  return (
    <Link href={`/teams/${team.id}`} className="block">
      <article className={`canal-card border-l-4 ${borderColor} hover:bg-canal-gray-mid transition-colors`}>
        <div className="flex items-center gap-3">
          {rank && (
            <div className="text-2xl font-black text-canal-gray-muted w-8 text-center flex-shrink-0">
              {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white truncate">{team.name}</h3>
              {hasPendingRequest && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                  <Clock size={9} /> En attente
                </span>
              )}
              {pendingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-400">
                  <Clock size={9} /> {pendingCount} à valider
                </span>
              )}
            </div>
            <p className="text-xs text-canal-gray-muted italic truncate">{team.slogan}</p>
            {team.members && team.members.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {team.members.map((m) => (
                  <span key={m.id} className="text-[10px] bg-canal-gray-mid border border-canal-gray-light text-canal-gray-muted px-1.5 py-0.5 rounded-full">
                    {m.display_name ?? m.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span className="text-canal-yellow font-black text-lg">{team.total_points}</span>
            <span className="text-xs text-canal-gray-muted">pts</span>
          </div>

          <ChevronRight size={16} className="text-canal-gray-muted flex-shrink-0" />
        </div>
      </article>
    </Link>
  );
}
