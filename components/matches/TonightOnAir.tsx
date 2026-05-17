import type { Match } from "@/lib/supabase/types";
import { teamFlag, toNCTime } from "@/lib/utils";
import { getChannelConfig } from "@/lib/channels";
import { cn } from "@/lib/utils";
import { Tv2 } from "lucide-react";

interface TonightOnAirProps {
  matches: Match[];
  title?: string;
}

export function TonightOnAir({ matches, title = "Ce soir en direct" }: TonightOnAirProps) {
  if (matches.length === 0) return null;

  return (
    <div className="canal-card border border-canal-yellow/20">
      <div className="flex items-center gap-2 mb-3">
        <Tv2 size={16} className="text-canal-yellow" />
        <span className="text-sm font-black text-canal-yellow uppercase tracking-wider">{title}</span>
      </div>

      <div className="space-y-3">
        {matches.map((match) => {
          const channel = getChannelConfig(match.channel);
          const isCanal = channel.brand === "canal";

          return (
            <div
              key={match.id}
              className={cn(
                "flex items-center gap-3 rounded-xl p-3 border",
                isCanal
                  ? "bg-canal-yellow/5 border-canal-yellow/20"
                  : "bg-red-950/20 border-red-900/30"
              )}
            >
              {/* Drapeaux */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-2xl">{teamFlag(match.flag_a, match.team_a)}</span>
                <span className="text-canal-gray-muted text-xs font-bold">vs</span>
                <span className="text-2xl">{teamFlag(match.flag_b, match.team_b)}</span>
              </div>

              {/* Info match */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">
                  {match.team_a} — {match.team_b}
                </p>
                <p className="text-canal-gray-muted text-xs">
                  🕐 {toNCTime(match.starts_at)} NC
                </p>
              </div>

            </div>
          );
        })}
      </div>

      {/* CTA ambiance */}
      <p className="mt-3 text-center text-xs text-canal-gray-muted italic">
        Ce soir, le bureau risque de se retrouver devant l'écran commun. 📺
      </p>
    </div>
  );
}
