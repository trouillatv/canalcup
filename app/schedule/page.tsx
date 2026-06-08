"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Flag } from "@/components/shared/Flag";
import { LocalTime } from "@/components/timezone/LocalTime";
import { cn } from "@/lib/utils";

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a?: number | null;
  score_b?: number | null;
  status: string;
  starts_at: string;
  phase?: string;
  stage?: string;
  channel?: string;
}

interface DayGroup {
  dateKey: string;   // "2026-06-11"
  label: string;     // "Mercredi 11 juin"
  matches: MatchRow[];
}

function groupByDay(matches: MatchRow[]): DayGroup[] {
  const map = new Map<string, MatchRow[]>();
  for (const m of matches) {
    const d = new Date(m.starts_at);
    // Use local date string as key (YYYY-MM-DD)
    const key = d.toLocaleDateString("fr-CA"); // YYYY-MM-DD in fr-CA locale
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(m);
  }
  return Array.from(map.entries()).map(([key, ms]) => {
    const d = new Date(ms[0].starts_at);
    const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    return { dateKey: key, label: label.charAt(0).toUpperCase() + label.slice(1), matches: ms };
  });
}

function todayKey(): string {
  return new Date().toLocaleDateString("fr-CA");
}

const RESULT_STYLE: Record<string, string> = {
  W: "bg-green-500/20 text-green-400 border-green-500/40",
  D: "bg-yellow-400/15 text-yellow-400 border-yellow-400/30",
  L: "bg-red-500/15 text-red-400 border-red-500/30",
};

function resultFor(match: MatchRow, side: "a" | "b"): "W" | "D" | "L" | null {
  if (match.status !== "finished" || match.score_a == null || match.score_b == null) return null;
  const diff = match.score_a - match.score_b;
  if (diff === 0) return "D";
  if (side === "a") return diff > 0 ? "W" : "L";
  return diff < 0 ? "W" : "L";
}

function MatchCard({ match }: { match: MatchRow }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";
  const resA = resultFor(match, "a");
  const resB = resultFor(match, "b");

  return (
    <Link
      href={`/matches/${match.id}`}
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 hover:bg-canal-gray-mid transition-colors rounded-xl",
        isLive && "bg-red-950/20"
      )}
    >
      {/* Équipe A */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
        {resA && isFinished && (
          <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0", RESULT_STYLE[resA])}>
            {resA === "W" ? "V" : resA === "D" ? "N" : "P"}
          </span>
        )}
        <span className={cn("font-semibold text-sm truncate text-right", isFinished && resA === "W" ? "text-white" : "text-canal-gray-muted")}>
          {match.team_a}
        </span>
        <Flag flag={match.flag_a} name={match.team_a} className="h-5 w-auto rounded-sm shrink-0" emojiClassName="text-lg leading-none shrink-0" />
      </div>

      {/* Score ou heure */}
      <div className="shrink-0 w-20 text-center">
        {isFinished || isLive ? (
          <span className={cn("font-black text-base tabular-nums", isLive ? "text-red-400" : "text-canal-yellow")}>
            {match.score_a ?? 0} – {match.score_b ?? 0}
          </span>
        ) : (
          <span className="text-canal-gray-muted text-sm font-medium tabular-nums">
            <LocalTime date={match.starts_at} variant="time" />
          </span>
        )}
        {isLive && (
          <p className="text-[9px] text-red-400 font-bold uppercase tracking-wider">Live</p>
        )}
        {match.channel && !isLive && (
          <p className="text-[9px] text-canal-gray-muted truncate">{match.channel}</p>
        )}
      </div>

      {/* Équipe B */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Flag flag={match.flag_b} name={match.team_b} className="h-5 w-auto rounded-sm shrink-0" emojiClassName="text-lg leading-none shrink-0" />
        <span className={cn("font-semibold text-sm truncate", isFinished && resB === "W" ? "text-white" : "text-canal-gray-muted")}>
          {match.team_b}
        </span>
        {resB && isFinished && (
          <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border shrink-0", RESULT_STYLE[resB])}>
            {resB === "W" ? "V" : resB === "D" ? "N" : "P"}
          </span>
        )}
      </div>
    </Link>
  );
}

export default function SchedulePage() {
  const [groups, setGroups] = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const todayRef = useRef<HTMLDivElement | null>(null);
  const today = todayKey();

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((d) => {
        setGroups(groupByDay(d.matches ?? []));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Scroll to today's section on load
  useEffect(() => {
    if (!loading && todayRef.current) {
      todayRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [loading]);

  return (
    <div className="max-w-2xl mx-auto pb-24">
      <div className="px-4 py-4">
        <h1 className="canal-headline text-2xl">Calendrier CdM 2026</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Tous les matchs · scores en direct</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {groups.map((day) => {
        const isToday = day.dateKey === today;
        const hasPast = day.matches.some((m) => m.status === "finished");
        const hasLive = day.matches.some((m) => m.status === "live" || m.status === "halftime");

        return (
          <div
            key={day.dateKey}
            ref={isToday ? todayRef : undefined}
            className="mb-1"
          >
            {/* Header de jour */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 sticky top-14 z-10",
              isToday ? "bg-canal-yellow/10" : "bg-canal-black/95"
            )}>
              <span className={cn(
                "text-xs font-black uppercase tracking-wider",
                isToday ? "text-canal-yellow" : "text-canal-gray-muted"
              )}>
                {day.label}
              </span>
              {hasLive && (
                <span className="text-[9px] font-black text-red-400 bg-red-950/40 border border-red-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                  Live
                </span>
              )}
              {isToday && !hasLive && (
                <span className="text-[9px] font-black text-canal-yellow bg-canal-yellow/10 border border-canal-yellow/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                  Aujourd'hui
                </span>
              )}
              <span className="ml-auto text-[10px] text-canal-gray-muted">
                {day.matches.length} match{day.matches.length > 1 ? "s" : ""}
                {hasPast && ` · ${day.matches.filter((m) => m.status === "finished").length} terminé${day.matches.filter((m) => m.status === "finished").length > 1 ? "s" : ""}`}
              </span>
            </div>

            {/* Matchs du jour */}
            <div className="px-2 divide-y divide-canal-gray-light/20">
              {day.matches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </div>
        );
      })}

      {!loading && groups.length === 0 && (
        <p className="text-center text-canal-gray-muted py-20">Aucun match disponible.</p>
      )}
    </div>
  );
}
