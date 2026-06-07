"use client";

import Link from "next/link";
import { toNCDate, toNCTime } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";
import { useTimezone } from "@/components/timezone/TimezoneProvider";
import type { Match } from "@/lib/supabase/types";

interface SavedPrediction { score_a: number; score_b: number; points?: number }

function CompactRow({
  match,
  prediction,
}: {
  match: Match;
  prediction?: SavedPrediction;
}) {
  const { tz } = useTimezone();
  const isLive = match.status === "live";
  const isFinished = match.status === "finished";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-xl cursor-pointer transition-colors hover:bg-canal-gray-mid/60 ${
          isLive ? "bg-red-950/20" : ""
        }`}
      >
        <span className="w-6 shrink-0 leading-none"><Flag flag={match.flag_a} name={match.team_a} className="h-4 w-auto rounded-sm" emojiClassName="text-base leading-none" /></span>
        <span className={`text-xs font-bold flex-1 min-w-0 truncate ${
          isFinished ? "text-canal-gray-muted" : "text-white"
        }`}>
          {match.team_a}
        </span>

        {/* Score or time */}
        <div className="shrink-0 w-14 text-center">
          {(isLive || isFinished) && hasScore ? (
            <span className={`text-xs font-black ${isLive ? "text-red-400" : "text-canal-yellow"}`}>
              {match.score_a}–{match.score_b}
            </span>
          ) : (
            <span className="text-xs text-canal-gray-muted font-medium">
              {toNCTime(match.starts_at, tz)}
            </span>
          )}
        </div>

        <span className={`text-xs font-bold flex-1 min-w-0 truncate text-right ${
          isFinished ? "text-canal-gray-muted" : "text-white"
        }`}>
          {match.team_b}
        </span>
        <span className="w-6 shrink-0 text-right leading-none"><Flag flag={match.flag_b} name={match.team_b} className="h-4 w-auto rounded-sm" emojiClassName="text-base leading-none" /></span>

        {/* My prediction (if exists) */}
        {prediction && (
          <div className="shrink-0 w-12 text-right">
            <span className={`text-xs font-bold rounded px-1 py-0.5 ${
              prediction.points && prediction.points > 0
                ? "text-canal-green bg-canal-green/10"
                : "text-canal-gray-muted"
            }`}>
              {prediction.score_a}–{prediction.score_b}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function DateGroup({ dateLabel, matches, myPredictions }: {
  dateLabel: string;
  matches: Match[];
  myPredictions: Record<string, SavedPrediction>;
}) {
  return (
    <div>
      <p className="text-xs text-canal-gray-muted font-semibold px-3 py-1">{dateLabel}</p>
      {matches.map((m) => (
        <CompactRow key={m.id} match={m} prediction={myPredictions[m.id]} />
      ))}
    </div>
  );
}

export function MatchesCompact({
  matches,
  myPredictions,
}: {
  matches: Match[];
  myPredictions: Record<string, SavedPrediction>;
}) {
  const { tz } = useTimezone();
  const live = matches.filter((m) => m.status === "live" || m.status === "halftime");
  const upcoming = matches.filter((m) => m.status === "upcoming");
  const finished = matches.filter((m) => m.status === "finished");

  // Group upcoming by date
  const upcomingByDate = new Map<string, Match[]>();
  for (const m of upcoming) {
    const day = toNCDate(m.starts_at, tz);
    if (!upcomingByDate.has(day)) upcomingByDate.set(day, []);
    upcomingByDate.get(day)!.push(m);
  }

  return (
    <div className="space-y-3">
      {live.length > 0 && (
        <div>
          <p className="text-xs font-black text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5 px-1">
            <span className="live-dot" /> En direct
          </p>
          <div className="canal-card p-1">
            {live.map((m) => <CompactRow key={m.id} match={m} prediction={myPredictions[m.id]} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p className="text-xs font-black text-canal-yellow uppercase tracking-wider mb-1.5 px-1">⚽ À venir</p>
          <div className="canal-card p-1">
            {[...upcomingByDate.entries()].map(([day, dayMatches]) => (
              <DateGroup
                key={day}
                dateLabel={day}
                matches={dayMatches}
                myPredictions={myPredictions}
              />
            ))}
          </div>
        </div>
      )}

      {finished.length > 0 && (
        <div>
          <p className="text-xs font-bold text-canal-gray-muted uppercase tracking-wider mb-1.5 px-1">Terminés</p>
          <div className="canal-card p-1">
            {finished.map((m) => <CompactRow key={m.id} match={m} prediction={myPredictions[m.id]} />)}
          </div>
        </div>
      )}

      {matches.length === 0 && (
        <p className="text-canal-gray-muted text-sm text-center py-10">Aucun match disponible.</p>
      )}
    </div>
  );
}
