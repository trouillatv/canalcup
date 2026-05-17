import type { Match } from "@/lib/supabase/types";
import { teamFlag, toNCDate, toNCTime } from "@/lib/utils";
import { ChannelBadge } from "./ChannelBadge";
import { getChannelConfig } from "@/lib/channels";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchOfWeekHeroProps {
  match: Match;
  tagline?: string;
}

export function MatchOfWeekHero({ match, tagline }: MatchOfWeekHeroProps) {
  const channel = getChannelConfig(match.channel);
  const isCanal = channel.brand === "canal";

  return (
    <div
      className={cn(
        "rounded-2xl p-5 border-2 relative overflow-hidden",
        isCanal
          ? "bg-gradient-to-br from-canal-black via-canal-gray to-canal-gray-mid border-canal-yellow/60"
          : "bg-gradient-to-br from-canal-black via-red-950/40 to-canal-gray-mid border-red-700/50"
      )}
    >
      {/* Badge flottant */}
      <div className="flex items-center gap-2 mb-4">
        <span className="flex items-center gap-1 canal-badge">
          <Star size={10} fill="currentColor" /> Match de la semaine
        </span>
        <ChannelBadge channel={match.channel} size="md" />
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-5xl">{teamFlag(match.flag_a, match.team_a)}</span>
          <span className="font-black text-white text-base text-center">{match.team_a}</span>
        </div>

        <div className="flex flex-col items-center gap-1 px-2">
          {match.status === "finished" ? (
            <div className="flex gap-2 items-center">
              <span className="font-black text-canal-yellow text-4xl">{match.score_a}</span>
              <span className="text-canal-gray-muted font-bold text-2xl">–</span>
              <span className="font-black text-canal-yellow text-4xl">{match.score_b}</span>
            </div>
          ) : (
            <span className="font-black text-canal-gray-muted text-3xl">VS</span>
          )}
          <div className="text-center mt-1">
            <p className="text-canal-gray-muted text-xs">{toNCDate(match.starts_at)}</p>
            <p className="text-white font-bold text-sm">{toNCTime(match.starts_at)} NC</p>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 flex-1">
          <span className="text-5xl">{teamFlag(match.flag_b, match.team_b)}</span>
          <span className="font-black text-white text-base text-center">{match.team_b}</span>
        </div>
      </div>

      {/* Tagline éditoriale */}
      {tagline && (
        <p className="mt-4 text-canal-gray-muted text-sm italic text-center border-t border-white/10 pt-3">
          "{tagline}"
        </p>
      )}
    </div>
  );
}
