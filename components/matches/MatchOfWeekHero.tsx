import Link from "next/link";
import type { Match } from "@/lib/supabase/types";
import { teamFlag } from "@/lib/utils";
import { getChannelConfig } from "@/lib/channels";
import { Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TeamLink } from "@/components/teams/TeamLink";
import { LocalTime } from "@/components/timezone/LocalTime";

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
      </div>

      {/* Teams + score */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col items-center flex-1">
          <TeamLink
            name={match.team_a}
            flag={teamFlag(match.flag_a, match.team_a)}
            stacked
            flagClassName="text-5xl"
            className="font-black text-white text-base text-center"
            wrapperClassName="gap-2"
          />
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
            <p className="text-canal-gray-muted text-xs"><LocalTime date={match.starts_at} variant="date" /></p>
            <p className="text-white font-bold text-sm"><LocalTime date={match.starts_at} variant="time" withLabel /></p>
          </div>
        </div>

        <div className="flex flex-col items-center flex-1">
          <TeamLink
            name={match.team_b}
            flag={teamFlag(match.flag_b, match.team_b)}
            stacked
            flagClassName="text-5xl"
            className="font-black text-white text-base text-center"
            wrapperClassName="gap-2"
          />
        </div>
      </div>

      {/* Tagline éditoriale */}
      {tagline && (
        <p className="mt-4 text-canal-gray-muted text-sm italic text-center border-t border-white/10 pt-3">
          "{tagline}"
        </p>
      )}

      {/* Lien vers le centre du match */}
      <Link
        href={`/matches/${match.id}`}
        className={cn(
          "mt-3 flex items-center justify-center gap-1 text-xs font-bold rounded-lg py-2 transition-colors",
          match.status === "live"
            ? "text-red-400 hover:text-red-300 bg-red-950/20"
            : "text-canal-yellow hover:text-yellow-300"
        )}
      >
        {match.status === "live"
          ? "🔴 Suivre en direct"
          : match.status === "finished"
          ? "Voir le résumé"
          : "Centre du match"}
        <ChevronRight size={12} />
      </Link>
    </div>
  );
}
