import Link from "next/link";
import type { Match } from "@/lib/supabase/types";
import { teamFlag, toNCTime } from "@/lib/utils";
import { getChannelConfig } from "@/lib/channels";
import { cn } from "@/lib/utils";
import { Tv2, ChevronRight } from "lucide-react";
import { TeamLink } from "@/components/teams/TeamLink";

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
              {/* Info match — chaque équipe (drapeau + nom) cliquable */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-bold text-white min-w-0">
                  <TeamLink
                    name={match.team_a}
                    flag={teamFlag(match.flag_a, match.team_a)}
                    flagClassName="text-2xl"
                    className="truncate"
                    wrapperClassName="min-w-0"
                  />
                  <span className="text-canal-gray-muted text-xs font-bold shrink-0">vs</span>
                  <TeamLink
                    name={match.team_b}
                    flag={teamFlag(match.flag_b, match.team_b)}
                    flagClassName="text-2xl"
                    className="truncate"
                    wrapperClassName="min-w-0"
                  />
                </div>
                <p className="text-canal-gray-muted text-xs mt-0.5">
                  🕐 {toNCTime(match.starts_at)} NC
                </p>
              </div>

              {/* Accès au centre du match */}
              <Link
                href={`/matches/${match.id}`}
                aria-label="Centre du match"
                className="shrink-0 flex items-center gap-0.5 text-xs font-bold text-canal-gray-muted hover:text-canal-yellow transition-colors"
              >
                Match <ChevronRight size={14} />
              </Link>
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
