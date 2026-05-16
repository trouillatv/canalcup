"use client";

import { cn, flagEmoji, toNCDate, toNCTime } from "@/lib/utils";
import type { Match, PredictionTrend } from "@/lib/supabase/types";
import { Star, Clock } from "lucide-react";
import { ChannelBadge } from "./ChannelBadge";
import { OddsDisplay } from "./OddsDisplay";

interface MatchCardProps {
  match: Match;
  trend?: PredictionTrend;
  userPrediction?: "A" | "DRAW" | "B";
  onPredict?: (result: "A" | "DRAW" | "B") => void;
  compact?: boolean;
}

export function MatchCard({ match, trend, userPrediction, onPredict, compact }: MatchCardProps) {
  const isFinished = match.status === "finished";
  const isLive = match.status === "live";
  const isUpcoming = match.status === "upcoming";

  return (
    <article className={cn("canal-card", compact && "p-3")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs text-canal-gray-muted">
          <Clock size={12} />
          <span>{toNCDate(match.starts_at)} — {toNCTime(match.starts_at)} NC</span>
        </div>
        <div className="flex items-center gap-2">
          {match.is_match_of_week && (
            <span className="canal-badge flex items-center gap-1">
              <Star size={10} /> Match de la semaine
            </span>
          )}
          {isLive && (
            <span className="flex items-center gap-1 text-xs text-red-400 font-bold">
              <span className="live-dot" /> LIVE
            </span>
          )}
          {isFinished && (
            <span className="text-xs text-canal-gray-muted">Terminé</span>
          )}
        </div>
      </div>

      {/* Match display */}
      <div className="flex items-center justify-between gap-4">
        {/* Team A */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-3xl">{flagEmoji(match.flag_a ?? match.team_a)}</span>
          <span className="text-sm font-bold text-white text-center leading-tight">
            {match.team_a}
          </span>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center gap-1">
          {isFinished || isLive ? (
            <div className="flex items-center gap-2">
              <span className="score-display text-3xl">
                {match.score_a ?? 0}
              </span>
              <span className="text-canal-gray-muted font-bold text-xl">-</span>
              <span className="score-display text-3xl">
                {match.score_b ?? 0}
              </span>
            </div>
          ) : (
            <span className="text-canal-gray-muted font-black text-2xl">VS</span>
          )}
          <ChannelBadge channel={match.channel} size="sm" />
        </div>

        {/* Team B */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-3xl">{flagEmoji(match.flag_b ?? match.team_b)}</span>
          <span className="text-sm font-bold text-white text-center leading-tight">
            {match.team_b}
          </span>
        </div>
      </div>

      {/* Cotes — si disponibles et match à venir */}
      {match.odds && isUpcoming && !compact && (
        <div className="mt-3 pt-3 border-t border-canal-gray-light">
          <OddsDisplay
            odds={match.odds}
            teamA={match.team_a}
            teamB={match.team_b}
            selected={userPrediction}
          />
        </div>
      )}

      {/* Prediction buttons (upcoming only) */}
      {isUpcoming && onPredict && !compact && (
        <div className="mt-3 flex gap-2">
          {(["A", "DRAW", "B"] as const).map((result) => {
            const labels: Record<typeof result, string> = {
              A: match.team_a,
              DRAW: "Nul",
              B: match.team_b,
            };
            const emojis: Record<typeof result, string> = {
              A: flagEmoji(match.flag_a ?? match.team_a),
              DRAW: "🤝",
              B: flagEmoji(match.flag_b ?? match.team_b),
            };
            const isSelected = userPrediction === result;
            return (
              <button
                key={result}
                onClick={() => onPredict(result)}
                className={cn(
                  "pred-btn",
                  isSelected ? "pred-btn-active" : "pred-btn-inactive"
                )}
              >
                <span className="text-lg">{emojis[result]}</span>
                <span className="text-xs leading-tight text-center">
                  {labels[result]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Trends */}
      {trend && trend.total > 0 && !compact && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-canal-gray-muted mb-1">
            <span>{trend.pct_a}%</span>
            <span className="text-center">{trend.pct_draw}% nul</span>
            <span>{trend.pct_b}%</span>
          </div>
          <div className="flex h-1.5 rounded-full overflow-hidden">
            <div className="bg-canal-yellow" style={{ width: `${trend.pct_a}%` }} />
            <div className="bg-canal-gray-light" style={{ width: `${trend.pct_draw}%` }} />
            <div className="bg-white/30" style={{ width: `${trend.pct_b}%` }} />
          </div>
          <div className="text-center text-xs text-canal-gray-muted mt-1">
            {trend.total} pronostics
          </div>
        </div>
      )}
    </article>
  );
}
