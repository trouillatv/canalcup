import Link from "next/link";
import type { Team } from "@/lib/supabase/types";
import { pointsBadge } from "@/lib/utils";
import { Users, ChevronRight } from "lucide-react";

interface TeamCardProps {
  team: Team;
  rank?: number;
  showDetails?: boolean;
}

const TEAM_COLORS = [
  "border-l-canal-yellow",
  "border-l-white/60",
  "border-l-yellow-700",
];

export function TeamCard({ team, rank, showDetails }: TeamCardProps) {
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

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-canal-gray-mid border border-canal-gray-light flex items-center justify-center flex-shrink-0">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-8 h-8 object-cover rounded-full" />
            ) : (
              <span className="text-lg font-black text-canal-yellow">
                {team.name[0]}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white truncate">{team.name}</h3>
              <span className="text-lg flex-shrink-0">{pointsBadge(team.total_points)}</span>
            </div>
            <p className="text-xs text-canal-gray-muted italic truncate">{team.slogan}</p>
            {showDetails && (
              <p className="text-xs text-canal-yellow mt-0.5 truncate">{team.reputation_label}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-canal-yellow font-black text-lg">
              {team.total_points}
            </span>
            <span className="text-xs text-canal-gray-muted">pts</span>
            {team.members && (
              <div className="flex items-center gap-1 text-xs text-canal-gray-muted">
                <Users size={10} />
                <span>{team.members.length}</span>
              </div>
            )}
          </div>

          <ChevronRight size={16} className="text-canal-gray-muted flex-shrink-0" />
        </div>
      </article>
    </Link>
  );
}
