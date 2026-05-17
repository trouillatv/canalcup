"use client";

import Link from "next/link";
import { teamFlag, toNCDate, toNCTime } from "@/lib/utils";
import { Countdown } from "./Countdown";
import type { Match } from "@/lib/supabase/types";

function TvMatchCard({ match }: { match: Match }) {
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  const winner =
    isFinished && hasScore && match.score_b !== null
      ? match.score_a! > match.score_b! ? "a" : match.score_a! < match.score_b! ? "b" : null
      : null;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`relative rounded-3xl border overflow-hidden cursor-pointer transition-all hover:border-canal-yellow/60 ${
          isLive
            ? "border-red-500/50 bg-gradient-to-b from-red-950/40 to-canal-gray"
            : isFinished
            ? "border-canal-gray-light/40 bg-gradient-to-b from-canal-gray-mid to-canal-gray"
            : "border-canal-gray-light/30 bg-gradient-to-b from-canal-gray-mid/60 to-canal-gray/40"
        }`}
      >
        {/* Top accent line */}
        {isLive && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        )}
        {isFinished && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-canal-yellow/40 to-transparent" />
        )}

        <div className="px-6 py-6">
          {/* Status badge */}
          <div className="flex justify-center mb-5">
            {isLive ? (
              <span className="flex items-center gap-2 bg-red-600 text-white text-sm font-black px-4 py-1.5 rounded-full animate-pulse">
                <span className="w-2 h-2 bg-white rounded-full" /> EN DIRECT
              </span>
            ) : isFinished ? (
              <span className="text-canal-gray-muted text-sm font-bold uppercase tracking-wider">TERMINÉ</span>
            ) : (
              <div className="text-center">
                <p className="text-canal-yellow font-black text-2xl">{toNCTime(match.starts_at)}</p>
                <p className="text-canal-gray-muted text-xs">{toNCDate(match.starts_at)} · NC</p>
              </div>
            )}
          </div>

          {/* Teams + score */}
          <div className="flex items-center gap-4">
            {/* Team A */}
            <div className={`flex-1 flex flex-col items-center gap-3 ${winner === "b" ? "opacity-35" : ""}`}>
              <span className="text-7xl leading-none">{teamFlag(match.flag_a, match.team_a)}</span>
              <span className={`font-black text-base text-center leading-tight max-w-24 ${
                winner === "a" ? "text-canal-yellow" : "text-white"
              }`}>
                {match.team_a}
              </span>
            </div>

            {/* Score center */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              {(isLive || isFinished) && hasScore ? (
                <div className="flex items-center gap-3">
                  <span className={`font-black text-6xl tabular-nums leading-none ${
                    winner === "a" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                  }`}>
                    {match.score_a}
                  </span>
                  <span className="text-canal-gray-muted text-4xl leading-none">–</span>
                  <span className={`font-black text-6xl tabular-nums leading-none ${
                    winner === "b" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                  }`}>
                    {match.score_b}
                  </span>
                </div>
              ) : (
                <span className="text-canal-gray-muted text-3xl font-black">VS</span>
              )}
            </div>

            {/* Team B */}
            <div className={`flex-1 flex flex-col items-center gap-3 ${winner === "a" ? "opacity-35" : ""}`}>
              <span className="text-7xl leading-none">{teamFlag(match.flag_b, match.team_b)}</span>
              <span className={`font-black text-base text-center leading-tight max-w-24 ${
                winner === "b" ? "text-canal-yellow" : "text-white"
              }`}>
                {match.team_b}
              </span>
            </div>
          </div>

          {/* Countdown for upcoming */}
          {match.status === "upcoming" && (
            <div className="flex justify-center items-center gap-2 mt-5 text-sm text-canal-gray-muted">
              <span>Dans</span>
              <Countdown startsAt={match.starts_at} />
            </div>
          )}

          {match.is_match_of_week && (
            <div className="mt-4 text-center">
              <span className="canal-badge text-xs">⭐ Match de la semaine</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

export function MatchesTv({ matches }: { matches: Match[] }) {
  const live = matches.filter((m) => m.status === "live" || m.status === "halftime");
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const featured = [...live, ...upcoming].slice(0, 3);

  if (!featured.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <span className="text-6xl">⚽</span>
        <p className="text-canal-gray-muted text-lg font-medium">Aucun match en cours ou à venir.</p>
        <p className="text-canal-gray-muted text-sm italic">"Le bureau est en attente. Patiemment."</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {featured.map((m) => <TvMatchCard key={m.id} match={m} />)}
    </div>
  );
}
