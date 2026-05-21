"use client";

import React, { useState, useEffect, useRef } from "react";
import { teamFlag, toNCDate, toNCTime } from "@/lib/utils";
import { QrCode } from "lucide-react";
import type { Match, LeaderboardRow, MorningBrief, RevivezPost, CanalCupEvent, Challenge } from "@/lib/supabase/types";
import { PARTICIPATION_MIN_POINTS } from "@/lib/scoring/config";
import type { FullMatchDetail } from "@/services/football/types";
import {
  EVENT_CONFIGS,
  DUEL_PHRASES,
  getHypePhrase,
  getHypeLevelBadge,
  formatCountdown,
  formatNCTime,
  type EventType,
} from "@/lib/tv/hype";
import {
  FLASH_CONFIGS,
  getAtmosphericPhrase,
  type TvFlash,
} from "@/lib/tv/flash";
import {
  getRobertPreMatchPhrase,
  getSalonPhrase,
} from "@/lib/tv/hype";

type Slide = "upcoming" | "classement" | "match" | "livematch" | "duel" | "standings" | "bracket" | "matinale" | "revivez" | "prematch" | "animations";

const SLIDE_DURATION = 12000;
const REFRESH_INTERVAL = 30000;
const FLASH_POLL_INTERVAL = 10000;
// "animations" insérée après "upcoming" pour que le mur salon pousse les
// défis RSE entre 2 contenus sport — encourage la participation physique.
const BASE_SLIDES: Slide[] = ["prematch", "upcoming", "animations", "classement", "match", "livematch", "duel", "standings", "bracket", "matinale", "revivez"];

interface StandingRow {
  team_name_fr: string;
  team_flag: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  group_name: string;
}

interface AmbianceState {
  emoji: string;
  label: string;
  color: string;
  sub: string;
}

interface PreMatchStats {
  match: Match;
  total_teams: number;
  teams_predicted: number;
  teams_missing: number;
  pct_a: number;
  pct_b: number;
  pct_draw: number;
  top_result: "A" | "DRAW" | "B" | null;
  top_pct: number;
  top_score: string | null;
  top_score_pct: number;
  top_scorer: string | null;
  top_scorer_pct: number;
}

interface TVData {
  matches: Match[];
  leaderboard: LeaderboardRow[];
  brief: MorningBrief;
  revivezPosts: RevivezPost[];
  challenges?: Challenge[];
  standings?: StandingRow[];
  events?: CanalCupEvent[];
  ambiance?: AmbianceState | null;
  prematch?: PreMatchStats | null;
}

// ─── Ambiance Banner ─────────────────────────────────────────────────────────

function AmbianceBanner({ ambiance }: { ambiance: AmbianceState }) {
  return (
    <div
      className="flex items-center justify-center gap-4 py-2 border-b text-center animate-pulse"
      style={{ borderColor: ambiance.color + "40", backgroundColor: ambiance.color + "12" }}
    >
      <span className="text-2xl">{ambiance.emoji}</span>
      <div>
        <span className="font-black text-xl tracking-widest" style={{ color: ambiance.color }}>
          {ambiance.label}
        </span>
        <span className="text-canal-gray-muted text-base ml-4">{ambiance.sub}</span>
      </div>
      <span className="text-2xl">{ambiance.emoji}</span>
    </div>
  );
}

// ─── Countdown (client, ticks every second) ──────────────────────────────────

function LiveCountdown({ targetIso, isUrgent }: { targetIso: string; isUrgent: boolean }) {
  const [ms, setMs] = useState(() => new Date(targetIso).getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(() => setMs(new Date(targetIso).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);

  const label = formatCountdown(ms);

  return (
    <span
      className={`font-black tabular-nums transition-colors ${
        isUrgent
          ? "text-red-400 animate-pulse text-xl sm:text-4xl lg:text-5xl"
          : "text-canal-yellow text-lg sm:text-3xl lg:text-4xl"
      }`}
    >
      {label}
    </span>
  );
}

// ─── Slide: Prochains Moments ────────────────────────────────────────────────

function SlideUpcoming({ events, matches }: { events: CanalCupEvent[]; matches: Match[] }) {
  const now = Date.now();

  // Auto-inject upcoming match of the week as an event
  const matchWeek = matches.find((m) => m.is_match_of_week && m.status === "upcoming");
  const autoEvents: CanalCupEvent[] = matchWeek
    ? [
        {
          id: "auto-match-week",
          type: "match_week",
          title: `${matchWeek.team_a} vs ${matchWeek.team_b}`,
          starts_at: matchWeek.starts_at,
          teams: [matchWeek.team_a, matchWeek.team_b],
          hype_level: 3,
          robert_phrase: undefined,
          location: undefined,
          is_active: true,
          created_at: matchWeek.starts_at,
        } as CanalCupEvent,
      ]
    : [];

  const allEvents = [...events, ...autoEvents]
    .filter((e) => new Date(e.starts_at).getTime() > now - 15 * 60_000)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 3);

  if (!allEvents.length) {
    return (
      <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-6">
          ⏳ PROCHAINS MOMENTS CANAL CUP
        </p>
        <p className="text-canal-gray-muted text-xl sm:text-2xl text-center max-w-xl">
          Aucun événement prévu pour l'instant.
          <br />
          Le calme avant la tempête.
        </p>
        <p className="text-canal-gray-muted text-lg sm:text-xl mt-4 italic">
          "Robert aussi attend. Avec impatience et professionnalisme."
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-16 py-4 sm:py-8 space-y-4 sm:space-y-6">
      <div className="mb-2">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest">
          ⏳ PROCHAINS MOMENTS CANAL CUP
        </p>
        <div className="h-1 w-48 bg-canal-yellow mt-2" />
      </div>

      {allEvents.map((event) => {
        const msLeft = new Date(event.starts_at).getTime() - now;
        const minsLeft = Math.floor(msLeft / 60_000);
        const isUrgent = minsLeft <= 15 && msLeft > 0;
        const isPast = msLeft <= 0;
        const config = EVENT_CONFIGS[event.type as EventType] ?? EVENT_CONFIGS.custom;
        const phrase = getHypePhrase(event.type as EventType, minsLeft, event.robert_phrase);
        const badge = getHypeLevelBadge(event.hype_level);
        const timeLabel = formatNCTime(event.starts_at);

        return (
          <div
            key={event.id}
            className={`flex items-start gap-3 sm:gap-6 p-3 sm:p-5 rounded-2xl border transition-all ${
              isUrgent
                ? "bg-red-950/30 border-red-500/40"
                : isPast
                ? "bg-canal-gray/30 border-canal-gray-light/20 opacity-60"
                : "bg-canal-gray-mid/40 border-canal-gray-light/30"
            }`}
          >
            {/* Left: emoji + time */}
            <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0 w-16 sm:w-28">
              <span className="text-2xl sm:text-5xl">{config.emoji}</span>
              {!isPast ? (
                <LiveCountdown targetIso={event.starts_at} isUrgent={isUrgent} />
              ) : (
                <span className="text-canal-gray-muted text-sm sm:text-2xl font-bold">En cours</span>
              )}
              <span className="text-canal-gray-muted text-xs sm:text-lg">{timeLabel} NC</span>
            </div>

            {/* Right: content */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                <p className="font-black text-white text-base sm:text-2xl lg:text-3xl uppercase tracking-wide break-words">
                  {event.title || config.label}
                </p>
                <span className={`text-sm sm:text-lg font-bold ${badge.colorClass}`}>{badge.label}</span>
              </div>

              {event.teams && event.teams.length > 0 && (
                <p className="text-canal-yellow text-sm sm:text-xl font-bold mb-1 break-words">
                  {event.teams.join(" vs ")}
                </p>
              )}

              {event.location && (
                <p className="text-canal-gray-muted text-xs sm:text-lg mb-1 sm:mb-2 break-words">📍 {event.location}</p>
              )}

              <p className="text-canal-gray-muted text-sm sm:text-xl italic leading-snug break-words">
                "{phrase}"
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Slide: Timeline du jour ─────────────────────────────────────────────────

function SlideTimeline({ events, matches }: { events: CanalCupEvent[]; matches: Match[] }) {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  // Today's manual events
  const todayEvents = events.filter((e) => {
    const t = new Date(e.starts_at).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime();
  });

  // Today's matches as events
  const todayMatches = matches
    .filter((m) => {
      const t = new Date(m.starts_at).getTime();
      return t >= todayStart.getTime() && t <= todayEnd.getTime();
    })
    .map((m) => ({
      id: `match-${m.id}`,
      type: m.is_match_of_week ? "match_week" : "custom",
      title: `${m.team_a} vs ${m.team_b}`,
      starts_at: m.starts_at,
      hype_level: m.is_match_of_week ? 3 : 2,
      location: undefined,
      is_active: true,
    } as CanalCupEvent));

  const allItems = [...todayEvents, ...todayMatches].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );

  const dateLabel = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Pacific/Noumea",
  });

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-10">
      <div className="mb-4 sm:mb-8">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">
          📅 PLANNING DU JOUR
        </p>
        <p className="text-canal-gray-muted text-base sm:text-xl capitalize">{dateLabel} — Heure NC</p>
        <div className="h-1 w-40 bg-canal-yellow mt-3" />
      </div>

      {!allItems.length ? (
        <p className="text-canal-gray-muted text-xl sm:text-2xl italic">
          "Rien de prévu. Canal Cup ne fait pas de pause, lui."
        </p>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {allItems.map((item) => {
            const t = new Date(item.starts_at).getTime();
            const isPast = t < now - 15 * 60_000;
            const isCurrent = !isPast && t < now + 15 * 60_000;
            const msLeft = t - now;
            const config = EVENT_CONFIGS[item.type as EventType] ?? EVENT_CONFIGS.custom;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 sm:gap-6 py-2 sm:py-3 border-l-4 pl-3 sm:pl-6 transition-all ${
                  isCurrent
                    ? "border-canal-yellow"
                    : isPast
                    ? "border-canal-gray-light/30 opacity-40"
                    : "border-canal-gray-light/50"
                }`}
              >
                <span
                  className={`font-black text-lg sm:text-2xl w-14 sm:w-20 ${
                    isCurrent ? "text-canal-yellow" : isPast ? "text-canal-gray-muted" : "text-white"
                  }`}
                >
                  {formatNCTime(item.starts_at)}
                </span>
                <span className="text-2xl sm:text-3xl">{config.emoji}</span>
                <div className="flex-1">
                  <p
                    className={`font-black text-lg sm:text-2xl ${
                      isCurrent ? "text-white" : isPast ? "text-canal-gray-muted" : "text-white"
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.location && (
                    <p className="text-canal-gray-muted text-sm sm:text-lg">{item.location}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {isPast ? (
                    <span className="text-canal-gray-muted text-base sm:text-xl">✓ Terminé</span>
                  ) : isCurrent ? (
                    <span className="text-canal-yellow font-black text-base sm:text-xl animate-pulse">← MAINTENANT</span>
                  ) : (
                    <span className="text-canal-gray-muted text-base sm:text-xl">
                      dans {formatCountdown(msLeft)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Slide: Duel du tournoi ──────────────────────────────────────────────────

function SlideDuel({ leaderboard }: { leaderboard: LeaderboardRow[] }) {
  const sorted = [...leaderboard].sort((a, b) => b.total - a.total);
  if (sorted.length < 2) return null;

  const [first, second] = sorted;
  const gap = first.total - second.total;
  const phraseIdx = new Date().getHours() % DUEL_PHRASES.length;
  const phrase = DUEL_PHRASES[phraseIdx](gap, first.team.name, second.team.name);

  return (
    <div className="flex flex-col justify-center px-4 sm:px-8 lg:px-20 py-4 sm:py-12">
      <div className="mb-3 sm:mb-8">
        <p className="text-canal-yellow font-black text-sm sm:text-2xl uppercase tracking-widest mb-2">
          ⚔️ DUEL DU TOURNOI
        </p>
        <div className="h-1 w-24 sm:w-32 bg-canal-yellow" />
      </div>

      <div className="flex items-center gap-2 sm:gap-12 mb-4 sm:mb-10">
        {/* Team 1 */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase tracking-wider mb-1 sm:mb-3">🥇 EN TÊTE</p>
          <p className="font-black text-base sm:text-4xl lg:text-5xl text-white mb-1 sm:mb-3 leading-tight break-words">{first.team.name}</p>
          <p className="font-black text-3xl sm:text-5xl lg:text-8xl text-canal-yellow">{first.total}</p>
          <p className="text-canal-gray-muted text-xs sm:text-xl mt-0.5">points</p>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-1 sm:gap-3 shrink-0">
          <span className="font-black text-lg sm:text-4xl lg:text-5xl text-canal-gray-muted">VS</span>
          <div className="flex flex-col items-center">
            <span className="text-canal-gray-muted text-xs sm:text-lg">Écart</span>
            <span
              className={`font-black text-lg sm:text-3xl lg:text-4xl ${
                gap <= 5 ? "text-red-400" : gap <= 15 ? "text-orange-400" : "text-canal-gray-muted"
              }`}
            >
              {gap > 0 ? `+${gap}` : gap}
            </span>
            <span className="text-canal-gray-muted text-xs sm:text-lg">pts</span>
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex-1 min-w-0 text-center">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase tracking-wider mb-1 sm:mb-3">🥈 POURSUIT</p>
          <p className="font-black text-base sm:text-4xl lg:text-5xl text-white mb-1 sm:mb-3 leading-tight break-words">{second.team.name}</p>
          <p className="font-black text-3xl sm:text-5xl lg:text-8xl text-white">{second.total}</p>
          <p className="text-canal-gray-muted text-xs sm:text-xl mt-0.5">points</p>
        </div>
      </div>

      <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-3 sm:p-6 text-center">
        <p className="text-canal-gray-muted text-xs sm:text-xl italic">"{phrase}"</p>
      </div>
    </div>
  );
}

// ─── Slide: Classement ───────────────────────────────────────────────────────

function SlideClassement({ leaderboard }: { leaderboard: LeaderboardRow[] }) {
  const sorted = [...leaderboard].sort((a, b) => b.total - a.total).slice(0, 3);
  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <div className="mb-4 sm:mb-8">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2">
          Classement Général
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="space-y-3 sm:space-y-6">
        {sorted.map((row, i) => (
          <div key={row.team.id} className="flex items-center gap-3 sm:gap-8">
            <span className="text-2xl sm:text-5xl w-8 sm:w-16 shrink-0">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-lg sm:text-3xl lg:text-4xl text-white truncate">{row.team.name}</p>
              <p className="text-canal-gray-muted text-xs sm:text-xl italic truncate">{row.team.slogan}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-black text-2xl sm:text-5xl lg:text-6xl text-canal-yellow">{row.total}</p>
              <p className="text-canal-gray-muted text-xs sm:text-xl">points</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide: Match ────────────────────────────────────────────────────────────

function SlideMatch({ matches }: { matches: Match[] }) {
  const match = matches.find((m) => m.status === "live") ?? matches.find((m) => m.status === "upcoming");
  if (!match) return null;

  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <p className="text-canal-yellow font-black text-lg sm:text-2xl uppercase tracking-widest mb-4 sm:mb-12 text-center">
        {match.status === "live" ? "🔴 En Direct" : "⚽ Prochain Match"}
      </p>
      <div className="flex items-center gap-2 sm:gap-16 w-full justify-center">
        <div className="flex flex-col items-center gap-1 sm:gap-4 flex-1 min-w-0">
          <span className="text-4xl sm:text-6xl lg:text-8xl">{teamFlag(match.flag_a, match.team_a)}</span>
          <p className="font-black text-sm sm:text-3xl lg:text-4xl text-white text-center break-words leading-tight">{match.team_a}</p>
        </div>
        <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0">
          {match.status !== "upcoming" ? (
            <div className="flex gap-1 sm:gap-4 items-center">
              <span className="font-black text-3xl sm:text-6xl lg:text-8xl text-canal-yellow">{match.score_a ?? 0}</span>
              <span className="font-black text-2xl sm:text-4xl lg:text-5xl text-canal-gray-muted">–</span>
              <span className="font-black text-3xl sm:text-6xl lg:text-8xl text-canal-yellow">{match.score_b ?? 0}</span>
            </div>
          ) : (
            <span className="font-black text-2xl sm:text-5xl lg:text-6xl text-canal-gray-muted">VS</span>
          )}
          <p className="text-canal-gray-muted text-xs sm:text-xl text-center">
            {toNCDate(match.starts_at)} — {toNCTime(match.starts_at)} NC
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 sm:gap-4 flex-1 min-w-0">
          <span className="text-4xl sm:text-6xl lg:text-8xl">{teamFlag(match.flag_b, match.team_b)}</span>
          <p className="font-black text-sm sm:text-3xl lg:text-4xl text-white text-center break-words leading-tight">{match.team_b}</p>
        </div>
      </div>
      {match.is_match_of_week && (
        <div className="mt-6 sm:mt-12 canal-badge text-base sm:text-xl px-4 sm:px-6 py-2">⭐ Match de la semaine</div>
      )}
    </div>
  );
}

// ─── Slide: Live Match (simplifié TV) ────────────────────────────────────────
// Score · buteurs · cartons · dernier fait marquant · compos avant-match · MOTM
function SlideLiveMatch({ matches }: { matches: Match[] }) {
  const target =
    matches.find((m) => m.status === "live" || m.status === "halftime") ??
    matches.find((m) => m.status === "finished") ??
    matches.find((m) => m.status === "upcoming");

  const [detail, setDetail] = useState<FullMatchDetail | null>(null);

  useEffect(() => {
    if (!target) return;
    let stop = false;
    const load = () =>
      fetch(`/api/matches/${target.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!stop) setDetail(d); })
        .catch(() => {});
    load();
    const live = target.status === "live" || target.status === "halftime";
    const t = live ? setInterval(load, 20000) : null;
    return () => { stop = true; if (t) clearInterval(t); };
  }, [target?.id, target?.status]);

  if (!target) return null;

  const m = detail?.match;
  const status = m?.status ?? target.status;
  const isUpcoming = status === "upcoming";
  const isFinished = status === "finished";
  const events = detail?.events ?? [];
  const goals = events.filter((e) => e.type === "goal");
  const cards = events.filter((e) => e.type === "yellow_card" || e.type === "red_card");
  const lastEvent = [...events].sort((a, b) => b.minute - a.minute)[0] ?? null;
  const motm = (detail?.playerStats ?? []).find((p) => p.is_motm) ?? null;

  const sideGoals = (side: "home" | "away") =>
    goals
      .filter((g) => g.team_side === side)
      .map((g) => `${g.player_name} ${g.minute}'`)
      .join(" · ");

  const statusLabel = isUpcoming
    ? "⚽ Prochain match"
    : isFinished
    ? "✅ Terminé"
    : status === "halftime"
    ? "⏸ Mi-temps"
    : `🔴 En direct${m?.minute ? ` · ${m.minute}'` : ""}`;

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-10 lg:px-24 py-6 sm:py-10">
      <p className="text-canal-yellow font-black text-base sm:text-2xl uppercase tracking-widest mb-4 sm:mb-8 text-center">
        {statusLabel}
      </p>

      <div className="flex items-center gap-2 sm:gap-12 w-full justify-center">
        <div className="flex flex-col items-center gap-1 sm:gap-3 flex-1 min-w-0">
          <span className="text-4xl sm:text-7xl lg:text-8xl">{teamFlag(target.flag_a, target.team_a)}</span>
          <p className="font-black text-sm sm:text-3xl text-white text-center break-words leading-tight">{target.team_a}</p>
        </div>
        <div className="flex flex-col items-center gap-1 shrink-0">
          {isUpcoming ? (
            <span className="font-black text-2xl sm:text-5xl text-canal-gray-muted">VS</span>
          ) : (
            <div className="flex gap-2 sm:gap-5 items-center">
              <span className="font-black text-4xl sm:text-7xl lg:text-8xl text-canal-yellow tabular-nums">{m?.score_a ?? target.score_a ?? 0}</span>
              <span className="font-black text-2xl sm:text-4xl text-canal-gray-muted">–</span>
              <span className="font-black text-4xl sm:text-7xl lg:text-8xl text-canal-yellow tabular-nums">{m?.score_b ?? target.score_b ?? 0}</span>
            </div>
          )}
          <p className="text-canal-gray-muted text-xs sm:text-lg text-center mt-1">
            {toNCDate(target.starts_at)} — {toNCTime(target.starts_at)} NC
          </p>
        </div>
        <div className="flex flex-col items-center gap-1 sm:gap-3 flex-1 min-w-0">
          <span className="text-4xl sm:text-7xl lg:text-8xl">{teamFlag(target.flag_b, target.team_b)}</span>
          <p className="font-black text-sm sm:text-3xl text-white text-center break-words leading-tight">{target.team_b}</p>
        </div>
      </div>

      {/* Buteurs */}
      {goals.length > 0 && (
        <div className="flex justify-between gap-4 mt-6 sm:mt-10 max-w-4xl mx-auto w-full">
          <p className="flex-1 text-left text-white text-sm sm:text-2xl font-bold leading-snug">
            <span className="text-canal-gray-muted">⚽ </span>{sideGoals("home") || "—"}
          </p>
          <p className="flex-1 text-right text-white text-sm sm:text-2xl font-bold leading-snug">
            {sideGoals("away") || "—"}<span className="text-canal-gray-muted"> ⚽</span>
          </p>
        </div>
      )}

      {/* Cartons */}
      {cards.length > 0 && (
        <p className="text-center text-canal-gray-muted text-xs sm:text-xl mt-4 sm:mt-6">
          {cards
            .map((c) => `${c.type === "red_card" ? "🟥" : "🟨"} ${c.player_name} ${c.minute}'`)
            .join("   ")}
        </p>
      )}

      {/* Joueur du match (fini) */}
      {isFinished && motm && (
        <div className="mt-6 sm:mt-10 mx-auto canal-badge text-sm sm:text-2xl px-4 sm:px-8 py-2">
          ⭐ Joueur du match : {motm.player_name}
          {motm.rating != null && ` (${motm.rating.toFixed(1)})`}
        </div>
      )}

      {/* Compos avant-match */}
      {isUpcoming && detail?.lineups && (
        <div className="grid grid-cols-2 gap-6 sm:gap-16 mt-6 sm:mt-10 max-w-5xl mx-auto w-full">
          {(["home", "away"] as const).map((side) => (
            <div key={side}>
              <p className="text-canal-yellow font-black text-xs sm:text-lg uppercase tracking-wider mb-2 text-center">
                {side === "home" ? target.team_a : target.team_b}
              </p>
              <p className="text-white text-xs sm:text-lg text-center leading-relaxed">
                {detail.lineups![side]
                  .filter((p) => p.is_starting)
                  .map((p) => p.player_name)
                  .join(" · ") || "Compo à venir"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Dernier fait marquant (live, pas de but/carton plus parlant) */}
      {!isUpcoming && !isFinished && goals.length === 0 && cards.length === 0 && lastEvent && (
        <p className="text-center text-canal-gray-muted text-sm sm:text-xl mt-6 italic">
          Dernier fait : {lastEvent.player_name} {lastEvent.minute}'
        </p>
      )}

      {target.is_match_of_week && (
        <div className="mt-6 sm:mt-8 mx-auto canal-badge text-sm sm:text-xl px-4 sm:px-6 py-2">⭐ Match de la semaine</div>
      )}
    </div>
  );
}

// ─── Slide: Standings ────────────────────────────────────────────────────────

function SlideStandings({ standings }: { standings: StandingRow[] }) {
  const byGroup: Record<string, StandingRow[]> = {};
  for (const row of standings) {
    if (!byGroup[row.group_name]) byGroup[row.group_name] = [];
    byGroup[row.group_name].push(row);
  }
  const groups = Object.entries(byGroup)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 4);

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-canal-gray-muted text-xl sm:text-2xl">Classement disponible dès le début du tournoi</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-12 py-4 sm:py-8">
      <div className="mb-4 sm:mb-6">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2">
          ⚽ Classement FIFA WC 2026
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-8">
        {groups.map(([groupName, rows]) => {
          const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);
          return (
            <div key={groupName}>
              <p className="text-canal-yellow font-black text-sm sm:text-lg mb-1.5 sm:mb-3 uppercase">{groupName}</p>
              <div className="space-y-1 sm:space-y-2">
                {sorted.slice(0, 4).map((row, i) => (
                  <div
                    key={row.team_name_fr}
                    className={`flex items-center gap-2 sm:gap-3 ${i < 2 ? "text-white" : "text-canal-gray-muted"}`}
                  >
                    <span className="w-4 sm:w-5 text-center font-bold text-sm sm:text-lg shrink-0">{i + 1}</span>
                    <span className="text-base sm:text-2xl shrink-0">{teamFlag(row.team_flag, row.team_name_fr)}</span>
                    <span className={`flex-1 min-w-0 truncate text-sm sm:text-xl ${i < 2 ? "font-bold" : ""}`}>{row.team_name_fr}</span>
                    <span className="font-black text-base sm:text-2xl text-canal-yellow shrink-0">{row.points}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Slide: Matinale ─────────────────────────────────────────────────────────

function SlideMatinale({ brief }: { brief: MorningBrief }) {
  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <p className="text-canal-yellow font-black text-lg sm:text-2xl uppercase tracking-widest mb-3 sm:mb-4">
        📰 Matinale du {toNCDate(brief.date)}
      </p>
      <h2 className="font-black text-xl sm:text-4xl lg:text-5xl text-white leading-tight mb-3 sm:mb-8 break-words">{brief.title}</h2>
      <p className="text-canal-gray-muted text-base sm:text-2xl leading-relaxed mb-3 sm:mb-8 max-w-4xl break-words">{brief.body}</p>
      {brief.fail_of_day && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-3 sm:p-6">
          <p className="text-red-400 font-bold text-sm sm:text-xl mb-1 sm:mb-2">💥 Fail du jour</p>
          <p className="text-white text-base sm:text-2xl italic break-words">"{brief.fail_of_day}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Slide: Animations RSE à venir ────────────────────────────────────────────
// Mur salon : pousse les défis "live" et "upcoming" (max 5) pour
// rappeler aux gens d'aller participer physiquement (lieu, durée,
// solo/groupe, plancher de points garantis). Skip si zéro animation.

function SlideAnimations({ challenges }: { challenges: Challenge[] }) {
  const hasLive = challenges.some((c) => c.status === "live");
  const headerLabel = hasLive ? "🔴 Animations en cours" : "🎉 Prochaines animations";
  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-20 py-6 sm:py-10">
      <p className="text-canal-yellow font-black text-lg sm:text-2xl lg:text-3xl uppercase tracking-widest mb-4 sm:mb-8 text-center">
        {headerLabel}
      </p>
      <div className="flex-1 flex flex-col justify-center gap-3 sm:gap-5 max-w-5xl mx-auto w-full">
        {challenges.map((c) => {
          const isLive = c.status === "live";
          const isGroup = !!c.allows_group;
          const floor = c.max_points > 0
            ? Math.min(PARTICIPATION_MIN_POINTS, c.max_points)
            : PARTICIPATION_MIN_POINTS;
          return (
            <div
              key={c.id}
              className={`flex items-center gap-3 sm:gap-6 rounded-2xl border px-4 sm:px-6 py-3 sm:py-4 ${
                isLive
                  ? "border-red-500/60 bg-red-950/30"
                  : "border-canal-gray-light bg-canal-gray-mid/30"
              }`}
            >
              <span className="text-4xl sm:text-6xl lg:text-7xl shrink-0">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white text-lg sm:text-2xl lg:text-3xl leading-tight">
                    {c.title}
                  </p>
                  {isLive && (
                    <span className="text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                      Live
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 sm:gap-x-6 gap-y-1 mt-1 text-xs sm:text-base text-canal-gray-muted">
                  {c.location && <span>📍 {c.location}</span>}
                  {c.duration_minutes != null && <span>⏱ {c.duration_minutes} min</span>}
                  <span className="text-canal-yellow font-bold">
                    🏆 {c.max_points > 0 ? `${c.max_points} pts max` : "Hors classement"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:mt-2">
                  <span
                    className={`text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
                      isGroup
                        ? "bg-canal-yellow/20 text-canal-yellow border border-canal-yellow/40"
                        : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
                    }`}
                  >
                    {isGroup ? "👥 Groupe possible" : "👤 Solo"}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-green-900/40 text-green-400 border border-green-700/50">
                    ✨ ≥ {floor} pts garantis
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-canal-gray-muted text-sm sm:text-lg mt-4 sm:mt-8 italic">
        Va voir l&apos;animateur · ta participation rapporte des points à ton équipe.
      </p>
    </div>
  );
}

// ─── Slide: Revivez ──────────────────────────────────────────────────────────

function SlideRevivez({ posts }: { posts: RevivezPost[] }) {
  const post = posts[Math.floor(Math.random() * posts.length)];
  if (!post) return null;
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-lg sm:text-2xl uppercase tracking-widest mb-3 sm:mb-8">
        💬 Revivez — Les Archives du VAR
      </p>
      <div className="max-w-4xl">
        <p className="font-black text-base sm:text-2xl lg:text-3xl text-canal-gray-muted uppercase mb-3 sm:mb-6 break-words">{post.title}</p>
        <p className="text-white text-lg sm:text-3xl lg:text-4xl leading-relaxed italic font-medium break-words">"{post.content}"</p>
        {post.team && (
          <p className="text-canal-yellow text-sm sm:text-xl mt-3 sm:mt-8 font-bold">— {post.team.name}</p>
        )}
        <p className="text-canal-gray-muted text-sm sm:text-lg mt-3 sm:mt-4">❤️ {post.votes_count} votes</p>
      </div>
    </div>
  );
}

// ─── Clock (header) ──────────────────────────────────────────────────────────

function LiveClock() {
  const [time, setTime] = useState("");
  const ref = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString("fr-FR", {
          timeZone: "Pacific/Noumea",
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    update();
    ref.current = setInterval(update, 1000);
    return () => clearInterval(ref.current!);
  }, []);

  return <span className="text-white font-bold text-xl">{time}</span>;
}

// ─── Slide: Bracket knockout ─────────────────────────────────────────────────

interface TvMatchRow {
  id: string; team_a: string; team_b: string;
  flag_a?: string; flag_b?: string;
  score_a?: number | null; score_b?: number | null;
  status: string; starts_at: string; phase?: string;
}

interface TvBracketPhase { phase: string; groups: { matches: TvMatchRow[] }[] }

const TV_PHASE_EMOJIS: Record<string, string> = {
  Huitièmes: "🔥", Quarts: "⚡", Demis: "🌟", "3ème place": "🥉", Finale: "🏆",
};
const TV_PHASE_LABELS: Record<string, string> = {
  Huitièmes: "Huitièmes de finale", Quarts: "Quarts de finale",
  Demis: "Demi-finales", "3ème place": "Match pour la 3ème place", Finale: "Grande Finale",
};

function SlideBracket() {
  const [phases, setPhases] = useState<TvBracketPhase[]>([]);

  useEffect(() => {
    fetch("/api/bracket")
      .then((r) => r.json())
      .then((d: { phases: TvBracketPhase[] }) => setPhases(d.phases ?? []))
      .catch(() => {});
  }, []);

  // Only show knockout rounds (skip group stage — too dense for TV at distance)
  const knockout = phases.filter((p) => p.phase !== "Groupe");

  if (!knockout.length) {
    return (
      <div className="flex h-full items-center justify-center flex-col gap-4 sm:gap-6 px-4 sm:px-20">
        <span className="text-4xl sm:text-6xl">🏆</span>
        <p className="text-canal-gray-muted text-xl sm:text-2xl text-center">
          Phase à élimination directe pas encore commencée.
        </p>
        <p className="text-canal-gray-muted text-base sm:text-xl italic text-center">
          "La phase de groupes décide des combats. Patience."
        </p>
      </div>
    );
  }

  // Show the current most-active round (first with non-finished matches, else latest)
  const activePhase =
    knockout.find((p) => p.groups[0]?.matches.some((m) => m.status !== "finished")) ??
    knockout[knockout.length - 1];

  const matches = activePhase.groups[0]?.matches ?? [];
  const emoji = TV_PHASE_EMOJIS[activePhase.phase] ?? "⚽";
  const label = TV_PHASE_LABELS[activePhase.phase] ?? activePhase.phase;

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-16 py-4 sm:py-10">
      <div className="mb-4 sm:mb-8">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2">
          {emoji} {label}
        </p>
        <div className="h-1 w-48 bg-canal-yellow" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
        {matches.slice(0, 4).map((match) => {
          const isLive = match.status === "live" || match.status === "halftime";
          const isFinished = match.status === "finished";
          const hasScore = match.score_a !== null && match.score_a !== undefined;
          const winner =
            isFinished && hasScore && match.score_b !== null
              ? match.score_a! > match.score_b! ? "a" : match.score_a! < match.score_b! ? "b" : null
              : null;

          return (
            <div
              key={match.id}
              className={`rounded-2xl border p-3 sm:p-5 ${
                isLive
                  ? "border-red-500/50 bg-red-950/20"
                  : isFinished
                  ? "border-canal-yellow/20 bg-canal-gray-mid/40"
                  : "border-canal-gray-light/30 bg-canal-gray-mid/20"
              }`}
            >
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Team A */}
                <div className={`flex-1 text-center ${winner === "b" ? "opacity-35" : ""}`}>
                  <span className="text-3xl sm:text-5xl block mb-1 sm:mb-2 leading-none">{teamFlag(match.flag_a, match.team_a)}</span>
                  <p className={`font-black text-sm sm:text-lg leading-tight ${winner === "a" ? "text-canal-yellow" : "text-white"}`}>
                    {match.team_a || "—"}
                  </p>
                </div>

                {/* Score */}
                <div className="shrink-0 text-center flex flex-col gap-1">
                  {(isLive || isFinished) && hasScore ? (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className={`font-black text-3xl sm:text-5xl tabular-nums ${
                        winner === "a" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                      }`}>
                        {match.score_a}
                      </span>
                      <span className="text-canal-gray-muted text-xl sm:text-3xl">–</span>
                      <span className={`font-black text-3xl sm:text-5xl tabular-nums ${
                        winner === "b" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                      }`}>
                        {match.score_b}
                      </span>
                    </div>
                  ) : (
                    <p className="text-canal-gray-muted text-lg sm:text-2xl font-black">VS</p>
                  )}
                  {isLive && (
                    <p className="text-red-400 text-xs sm:text-base font-black animate-pulse">🔴 LIVE</p>
                  )}
                </div>

                {/* Team B */}
                <div className={`flex-1 text-center ${winner === "a" ? "opacity-35" : ""}`}>
                  <span className="text-3xl sm:text-5xl block mb-1 sm:mb-2 leading-none">{teamFlag(match.flag_b, match.team_b)}</span>
                  <p className={`font-black text-sm sm:text-lg leading-tight ${winner === "b" ? "text-canal-yellow" : "text-white"}`}>
                    {match.team_b || "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Phase progression indicator if all finished */}
      {matches.length > 0 && matches.every((m) => m.status === "finished") && (
        <p className="text-center text-canal-gray-muted text-base sm:text-xl mt-4 sm:mt-8 italic">
          "Tous qualifiés. Le prochain round s'annonce."
        </p>
      )}
    </div>
  );
}

// ─── Slide: Pre-match experience ─────────────────────────────────────────────

function getPreMatchPhase(msLeft: number): {
  countdownColor: string;
  pulse: boolean;
  borderClass: string;
  bgClass: string;
  moodLabel: string;
} {
  if (msLeft <= 60_000) return {
    countdownColor: "#FF1A1A", pulse: true,
    borderClass: "border-red-500", bgClass: "bg-red-950/30",
    moodLabel: "🚨 IMMINENTE",
  };
  if (msLeft <= 5 * 60_000) return {
    countdownColor: "#FF5500", pulse: true,
    borderClass: "border-orange-500/60", bgClass: "bg-orange-950/20",
    moodLabel: "⚡ TENSION MAXIMALE",
  };
  if (msLeft <= 15 * 60_000) return {
    countdownColor: "#FF8800", pulse: false,
    borderClass: "border-orange-400/40", bgClass: "bg-orange-950/10",
    moodLabel: "🔥 ÇA CHAUFFE",
  };
  if (msLeft <= 30 * 60_000) return {
    countdownColor: "#FFD700", pulse: false,
    borderClass: "border-canal-yellow/30", bgClass: "bg-canal-yellow/5",
    moodLabel: "🌡️ HYPE EN MONTÉE",
  };
  return {
    countdownColor: "#FFD700", pulse: false,
    borderClass: "border-canal-gray-light/20", bgClass: "bg-canal-gray-mid/10",
    moodLabel: "⏳ BIENTÔT",
  };
}

function PreMatchCountdown({ targetIso, msLeft }: { targetIso: string; msLeft: number }) {
  const [currentMs, setCurrentMs] = useState(msLeft);
  useEffect(() => {
    const t = setInterval(() => setCurrentMs(new Date(targetIso).getTime() - Date.now()), 1000);
    return () => clearInterval(t);
  }, [targetIso]);

  const phase = getPreMatchPhase(currentMs);
  const label = formatCountdown(currentMs);
  const totalSec = Math.floor(currentMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const isVeryClose = currentMs <= 5 * 60_000;

  return (
    <div className={`flex flex-col items-center gap-2 px-4 sm:px-10 py-3 sm:py-5 rounded-2xl border ${phase.borderClass} ${phase.bgClass} transition-all duration-1000`}>
      <p className="text-canal-gray-muted text-base sm:text-xl font-bold uppercase tracking-widest">
        {phase.moodLabel}
      </p>
      <span
        className={`font-black tabular-nums transition-colors ${phase.pulse ? "animate-pulse" : ""}`}
        style={{ fontSize: isVeryClose ? "clamp(3rem, 10vw, 8rem)" : "clamp(2.5rem, 8vw, 6rem)", color: phase.countdownColor, lineHeight: 1 }}
      >
        {isVeryClose && currentMs > 0
          ? `${mins}:${secs.toString().padStart(2, "0")}`
          : label}
      </span>
      <p className="text-canal-gray-muted text-base sm:text-xl">avant le coup d&apos;envoi</p>
    </div>
  );
}

// Panneau pré-match qui TOURNE : forme · derniers matchs · joueurs clés · compos
interface DossierTeam {
  name: string;
  form: string[];
  formCodes: ("V" | "N" | "D" | "?")[];
  recentScores: string[];
  keyPlayers: { name: string; position: string | null; club: string | null }[];
  squadValue: string | null;
}
interface MatchPreview {
  home: DossierTeam;
  away: DossierTeam;
  lineups: { home: string[]; away: string[] } | null;
}

const FORM_DOT: Record<string, string> = {
  V: "bg-green-500 text-black",
  N: "bg-canal-gray-light text-white",
  D: "bg-red-500 text-white",
  "?": "bg-canal-gray-mid text-canal-gray-muted",
};

function DossierColumn({ team, facet, lineup }: { team: DossierTeam; facet: string; lineup?: string[] }) {
  return (
    <div className="flex-1 min-w-0">
      {facet === "forme" && (
        <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center">
          {team.formCodes.length ? (
            team.formCodes.map((c, i) => (
              <span key={i} className={`w-7 h-7 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center font-black text-sm sm:text-2xl ${FORM_DOT[c]}`}>
                {c}
              </span>
            ))
          ) : (
            <span className="text-canal-gray-muted text-sm sm:text-xl">—</span>
          )}
        </div>
      )}
      {facet === "resultats" && (
        <div className="space-y-1 sm:space-y-1.5">
          {team.recentScores.length ? (
            team.recentScores.map((s, i) => (
              <p key={i} className="text-white text-xs sm:text-xl text-center leading-tight truncate">{s}</p>
            ))
          ) : (
            <p className="text-canal-gray-muted text-sm sm:text-xl text-center">Pas de données</p>
          )}
        </div>
      )}
      {facet === "joueurs" && (
        <div className="space-y-1 sm:space-y-1.5">
          {team.keyPlayers.length ? (
            team.keyPlayers.map((p, i) => (
              <p key={i} className="text-white text-xs sm:text-xl text-center leading-tight truncate">
                <span className="font-black">{p.name}</span>
                {p.club && <span className="text-canal-gray-muted"> · {p.club}</span>}
              </p>
            ))
          ) : (
            <p className="text-canal-gray-muted text-sm sm:text-xl text-center">—</p>
          )}
        </div>
      )}
      {facet === "compos" && (
        <p className="text-white text-xs sm:text-lg text-center leading-relaxed">
          {lineup && lineup.length ? lineup.join(" · ") : "Compo à venir"}
        </p>
      )}
    </div>
  );
}

function PreMatchDossier({ matchId, teamA, teamB, flagA, flagB }: {
  matchId: string; teamA: string; teamB: string; flagA?: string; flagB?: string;
}) {
  const [data, setData] = useState<MatchPreview | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/match-preview/${matchId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [matchId]);

  const facets = [
    { key: "forme", label: "🔥 Forme — 5 derniers" },
    { key: "resultats", label: "📅 Derniers matchs" },
    { key: "joueurs", label: "🎯 Joueurs offensifs à suivre" },
    ...(data?.lineups ? [{ key: "compos", label: "📋 Compositions probables" }] : []),
  ];

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % facets.length), 7000);
    return () => clearInterval(t);
  }, [facets.length]);

  if (!data) return null;
  const facet = facets[idx % facets.length];

  return (
    <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl px-4 sm:px-8 py-3 sm:py-5">
      <p className="text-canal-yellow font-black text-sm sm:text-xl uppercase tracking-widest text-center mb-2 sm:mb-4">
        {facet.label}
      </p>
      <div className="flex items-start gap-3 sm:gap-8">
        <DossierColumn team={data.home} facet={facet.key} lineup={data.lineups?.home} />
        <div className="shrink-0 flex flex-col items-center gap-1 px-1 sm:px-3">
          <span className="text-2xl sm:text-4xl">{teamFlag(flagA, teamA)}</span>
          <span className="text-canal-gray-muted font-black text-xs sm:text-lg">VS</span>
          <span className="text-2xl sm:text-4xl">{teamFlag(flagB, teamB)}</span>
        </div>
        <DossierColumn team={data.away} facet={facet.key} lineup={data.lineups?.away} />
      </div>
      <div className="flex justify-center gap-1.5 mt-2 sm:mt-3">
        {facets.map((f, i) => (
          <span key={f.key} className={`h-1.5 rounded-full transition-all ${i === idx % facets.length ? "w-6 bg-canal-yellow" : "w-1.5 bg-canal-gray-light"}`} />
        ))}
      </div>
    </div>
  );
}

function SlidePreMatch({ stats }: { stats: PreMatchStats }) {
  const { match } = stats;
  const msLeft = new Date(match.starts_at).getTime() - Date.now();
  const [salon, setSalon] = useState(() => getSalonPhrase(msLeft));

  useEffect(() => {
    const t = setInterval(() => setSalon(getSalonPhrase(new Date(match.starts_at).getTime() - Date.now())), 30_000);
    return () => clearInterval(t);
  }, [match.starts_at]);

  const topTeam = stats.top_result === "A" ? match.team_a : stats.top_result === "B" ? match.team_b : null;
  const robertCtx = {
    teamA: match.team_a,
    teamB: match.team_b,
    topResult: stats.top_result,
    topPct: stats.top_pct,
    teamsMissing: stats.teams_missing,
    msLeft,
  };

  return (
    <div className="flex flex-col h-full justify-start sm:justify-between px-4 sm:px-8 lg:px-16 py-4 sm:py-10 gap-4 sm:gap-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
        <p className="text-canal-yellow font-black text-lg sm:text-2xl uppercase tracking-widest">
          🏟️ PRÉ-MATCH
        </p>
        <p className="text-canal-gray-muted text-xs sm:text-xl">
          {toNCDate(match.starts_at)} · {toNCTime(match.starts_at)} NC
        </p>
      </div>

      {/* Teams + Countdown */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-8">
        {/* Team A */}
        <div className="flex-1 text-center min-w-0">
          <span className="text-4xl sm:text-6xl lg:text-8xl block mb-1 sm:mb-4 leading-none">{teamFlag(match.flag_a, match.team_a)}</span>
          <p className="font-black text-lg sm:text-3xl lg:text-4xl text-white break-words leading-tight">{match.team_a}</p>
        </div>

        {/* Countdown center */}
        <div className="shrink-0 mx-auto">
          <PreMatchCountdown targetIso={match.starts_at} msLeft={msLeft} />
        </div>

        {/* Team B */}
        <div className="flex-1 text-center min-w-0">
          <span className="text-4xl sm:text-6xl lg:text-8xl block mb-1 sm:mb-4 leading-none">{teamFlag(match.flag_b, match.team_b)}</span>
          <p className="font-black text-lg sm:text-3xl lg:text-4xl text-white break-words leading-tight">{match.team_b}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-5">
        {/* Bureau prédit */}
        <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-3 sm:p-5">
          <p className="text-canal-gray-muted text-xs sm:text-lg font-bold mb-1 sm:mb-2 uppercase tracking-wide">📊 Le bureau prédit</p>
          {stats.top_score ? (
            <>
              <p className="font-black text-base sm:text-2xl lg:text-3xl text-white mb-1">
                {stats.top_result === "A" ? match.team_a : stats.top_result === "B" ? match.team_b : "Match nul"}{" "}
                <span className="text-canal-yellow">{stats.top_score}</span>
              </p>
              <p className="text-canal-gray-muted text-xs sm:text-lg">
                {stats.top_score_pct}% des équipes · {stats.teams_predicted}/{stats.total_teams} ont pronostiqué
              </p>
            </>
          ) : (
            <p className="text-canal-gray-muted text-sm sm:text-xl">
              {stats.teams_predicted}/{stats.total_teams} équipes ont pronostiqué
            </p>
          )}

          {/* Result bar */}
          {stats.teams_predicted > 0 && (
            <div className="mt-2 sm:mt-3 flex rounded-full overflow-hidden h-2">
              {stats.pct_a > 0 && (
                <div className="bg-canal-yellow/70 h-full" style={{ width: `${stats.pct_a}%` }} title={`${match.team_a} ${stats.pct_a}%`} />
              )}
              {stats.pct_draw > 0 && (
                <div className="bg-canal-gray-muted/50 h-full" style={{ width: `${stats.pct_draw}%` }} title={`Nul ${stats.pct_draw}%`} />
              )}
              {stats.pct_b > 0 && (
                <div className="bg-blue-400/60 h-full" style={{ width: `${stats.pct_b}%` }} title={`${match.team_b} ${stats.pct_b}%`} />
              )}
            </div>
          )}
          <div className="flex justify-between text-xs text-canal-gray-muted mt-1">
            <span>{match.team_a} {stats.pct_a}%</span>
            <span>Nul {stats.pct_draw}%</span>
            <span>{stats.pct_b}% {match.team_b}</span>
          </div>
        </div>

        {/* Joueur à surveiller / confidence */}
        <div className="hidden sm:flex bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-3 sm:p-5 flex-col justify-between">
          {stats.top_scorer ? (
            <>
              <p className="text-canal-gray-muted text-sm sm:text-lg font-bold mb-2 uppercase tracking-wide">👀 Joueur à surveiller</p>
              <p className="font-black text-lg sm:text-2xl lg:text-3xl text-white">{stats.top_scorer}</p>
              <p className="text-canal-gray-muted text-sm sm:text-lg mt-1">
                {stats.top_scorer_pct}% pensent qu&apos;il marque ce soir.
              </p>
            </>
          ) : topTeam ? (
            <>
              <p className="text-canal-gray-muted text-sm sm:text-lg font-bold mb-2 uppercase tracking-wide">💪 Confiance</p>
              <p className="font-black text-lg sm:text-2xl lg:text-3xl text-white">{topTeam}</p>
              <p className="text-canal-gray-muted text-sm sm:text-lg mt-1">
                favori du bureau à <span className="text-canal-yellow font-bold">{stats.top_pct}%</span>
              </p>
            </>
          ) : (
            <>
              <p className="text-canal-gray-muted text-sm sm:text-lg font-bold mb-2 uppercase tracking-wide">🎲 Pronostics</p>
              <p className="font-black text-lg sm:text-2xl lg:text-3xl text-white">Indécis</p>
              <p className="text-canal-gray-muted text-sm sm:text-lg mt-1">Le bureau ne sait pas. C&apos;est rare.</p>
            </>
          )}
        </div>

        {/* Alerte non-pronostiqués */}
        <div className={`rounded-2xl p-3 sm:p-5 flex flex-col justify-between border ${
          stats.teams_missing > 0
            ? "bg-orange-950/20 border-orange-500/30"
            : "bg-canal-green/10 border-canal-green/30"
        }`}>
          {stats.teams_missing > 0 ? (
            <>
              <p className="text-orange-400 text-xs sm:text-lg font-bold mb-1 sm:mb-2 uppercase tracking-wide">⚠️ Alerte</p>
              <p className="font-black text-base sm:text-2xl lg:text-3xl text-white">{stats.teams_missing} équipe{stats.teams_missing > 1 ? "s" : ""} sans pronos</p>
            </>
          ) : (
            <>
              <p className="text-canal-green text-xs sm:text-lg font-bold mb-1 sm:mb-2 uppercase tracking-wide">✅ Complet</p>
              <p className="font-black text-base sm:text-2xl lg:text-3xl text-white">Tout le monde a pronostiqué</p>
            </>
          )}
        </div>
      </div>

      {/* Dossier pré-match tournant : forme · résultats · joueurs · compos */}
      <PreMatchDossier
        matchId={match.id}
        teamA={match.team_a}
        teamB={match.team_b}
        flagA={match.flag_a}
        flagB={match.flag_b}
      />

      {/* Robert quote + salon */}
      <div className="flex items-end justify-between gap-3 sm:gap-6">
        <div className="flex-1 bg-canal-gray-mid/30 border border-canal-gray-light/20 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-canal-gray-muted text-base sm:text-xl italic leading-snug">
            &ldquo;{getRobertPreMatchPhrase(robertCtx)}&rdquo;
          </p>
          <p className="text-canal-yellow/60 text-sm sm:text-lg mt-1">— Robert</p>
        </div>
        <p className="text-canal-gray-muted text-base sm:text-xl italic shrink-0 max-w-xs text-right hidden sm:block">{salon}</p>
      </div>
    </div>
  );
}

// ─── Flash Overlay (plein écran, 5s) ─────────────────────────────────────────

function FlashOverlay() {
  const [flash, setFlash] = useState<TvFlash | null>(null);
  const seenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const poll = () => {
      fetch("/api/tv/flash")
        .then((r) => r.json())
        .then((d: { flashes: TvFlash[] }) => {
          const newest = d.flashes[0];
          if (newest && !seenIds.current.has(newest.id)) {
            seenIds.current.add(newest.id);
            setFlash(newest);
            setTimeout(() => setFlash(null), 5000);
          }
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, FLASH_POLL_INTERVAL);
    return () => clearInterval(t);
  }, []);

  if (!flash) return null;
  const config = FLASH_CONFIGS[flash.type] ?? FLASH_CONFIGS.fire;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b ${config.bg} border-4 ${config.border} cursor-pointer`}
      onClick={() => setFlash(null)}
    >
      {flash.emoji && <span className="text-6xl sm:text-9xl mb-4 sm:mb-8 drop-shadow-lg">{flash.emoji}</span>}
      <p className={`font-black text-3xl sm:text-5xl lg:text-6xl tracking-widest mb-4 sm:mb-6 uppercase text-center px-4 sm:px-12 ${config.textColor} ${config.pulse ? "animate-pulse" : ""}`}>
        {flash.title}
      </p>
      {flash.subtitle && (
        <p className="text-xl sm:text-2xl lg:text-3xl text-canal-gray-muted text-center max-w-3xl leading-snug px-4 sm:px-8">
          {flash.subtitle}
        </p>
      )}
      <p className="absolute bottom-6 sm:bottom-12 text-canal-gray-muted text-sm sm:text-lg opacity-60">
        Appuyez pour fermer
      </p>
    </div>
  );
}

// ─── Atmospheric Status Line ──────────────────────────────────────────────────

function AtmosphericLine() {
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    setPhrase(getAtmosphericPhrase());
    const t = setInterval(() => setPhrase(getAtmosphericPhrase()), 120_000);
    return () => clearInterval(t);
  }, []);
  if (!phrase) return null;
  return (
    <div className="shrink-0 text-center py-2 border-t border-canal-gray-light/20">
      <p className="text-canal-gray-muted text-lg italic opacity-70">{phrase}</p>
    </div>
  );
}

// ─── PIN Gate (admin-only, URL key: /tv?pin=XXXX) ───────────────────────────

function PinGate({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pin = params.get("pin");
    // Verify against API (avoid exposing PIN in client bundle)
    fetch(`/api/tv/auth?pin=${encodeURIComponent(pin ?? "")}`)
      .then((r) => setOk(r.ok))
      .catch(() => setOk(false));
  }, []);

  if (ok === null) return (
    <div className="fixed inset-0 bg-canal-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!ok) return (
    <div className="fixed inset-0 bg-canal-black flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <p className="text-canal-yellow font-black text-3xl mb-2">CANAL CUP TV</p>
        <p className="text-canal-gray-muted text-xl">Accès réservé à l'affichage en salle.</p>
        <p className="text-canal-gray-muted text-lg mt-2">Contactez un administrateur pour obtenir le lien TV.</p>
      </div>
    </div>
  );

  return <>{children}</>;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TVPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [data, setData] = useState<TVData | null>(null);

  const fetchData = () => {
    fetch("/api/tv")
      .then((r) => r.json())
      .then((d: TVData) => setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, []);

  // Skip "animations" du cycle s'il n'y a aucun défi à pousser
  // (live + upcoming) → pas de slide vide en boucle sur le salon.
  const slides = data?.challenges?.length
    ? BASE_SLIDES
    : BASE_SLIDES.filter((s) => s !== "animations");

  useEffect(() => {
    const t = setInterval(
      () => setCurrentSlide((i) => (i + 1) % slides.length),
      SLIDE_DURATION
    );
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[currentSlide];

  return (
    <PinGate>
    <div className="fixed inset-0 bg-canal-black flex flex-col overflow-hidden tv-mode">
      <FlashOverlay />
      {/* Header */}
      <header className="flex items-center justify-between px-4 sm:px-8 lg:px-12 py-3 sm:py-4 border-b border-canal-gray-light shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <span className="text-canal-yellow font-black text-xl sm:text-2xl lg:text-3xl tracking-tight">CANAL</span>
          <span className="text-white font-black text-xl sm:text-2xl lg:text-3xl tracking-tight">CUP</span>
          <span className="text-canal-gray-muted text-xl sm:text-2xl lg:text-3xl font-bold">2026</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right">
            <p className="text-canal-gray-muted text-xs sm:text-sm">Heure NC</p>
            <LiveClock />
          </div>
          <div className="w-px h-8 sm:h-10 bg-canal-gray-light" />
          <div className="flex flex-col items-center gap-1">
            <QrCode size={28} className="text-canal-gray-muted sm:hidden" />
            <QrCode size={40} className="text-canal-gray-muted hidden sm:block" />
            <p className="text-xs text-canal-gray-muted">Scannez</p>
          </div>
        </div>
      </header>

      {/* Ambiance Banner — permanent quand un match est en direct */}
      {data?.ambiance && <AmbianceBanner ambiance={data.ambiance} />}

      {/* Slide area */}
      <div className="flex-1 animate-fade-in overflow-y-auto overflow-x-hidden sm:overflow-hidden" key={currentSlide}>
        {!data ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-canal-gray-muted text-xl sm:text-2xl">Chargement…</p>
          </div>
        ) : (
          <>
            {slide === "prematch" && (
              data.prematch
                ? <SlidePreMatch stats={data.prematch} />
                : (
                  <div className="flex h-full items-center justify-center flex-col gap-4 sm:gap-6 px-4 sm:px-20 text-center">
                    <span className="text-4xl sm:text-6xl">🏆</span>
                    <p className="text-canal-yellow font-black text-2xl sm:text-3xl">CANAL CUP 2026</p>
                    <p className="text-canal-gray-muted text-xl sm:text-2xl italic">
                      &ldquo;Aucun match à l&apos;horizon. Robert se repose. Temporairement.&rdquo;
                    </p>
                  </div>
                )
            )}
            {slide === "upcoming" && (
              <SlideUpcoming events={data.events ?? []} matches={data.matches} />
            )}
            {slide === "classement" && <SlideClassement leaderboard={data.leaderboard} />}
            {slide === "match" && <SlideMatch matches={data.matches} />}
            {slide === "livematch" && <SlideLiveMatch matches={data.matches} />}
            {slide === "duel" && <SlideDuel leaderboard={data.leaderboard} />}
            {slide === "standings" && <SlideStandings standings={data.standings ?? []} />}
            {slide === "bracket" && <SlideBracket />}
            {slide === "matinale" && <SlideMatinale brief={data.brief} />}
            {slide === "revivez" && <SlideRevivez posts={data.revivezPosts} />}
            {slide === "animations" && <SlideAnimations challenges={data.challenges ?? []} />}
          </>
        )}
      </div>

      {/* Atmospheric status line */}
      <AtmosphericLine />

      {/* Footer dots */}
      <footer className="flex items-center justify-center gap-3 pb-6 shrink-0">
        {slides.map((s, i) => (
          <button
            key={`${s}-${i}`}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentSlide
                ? "w-8 bg-canal-yellow"
                : s === "prematch"
                ? "w-2 bg-orange-500/50"
                : "w-2 bg-canal-gray-light"
            }`}
          />
        ))}
      </footer>
    </div>
    </PinGate>
  );
}
