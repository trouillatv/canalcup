"use client";

import React, { useState, useEffect, useRef } from "react";
import { flagEmoji, toNCDate, toNCTime } from "@/lib/utils";
import { QrCode } from "lucide-react";
import type { Match, LeaderboardRow, MorningBrief, RevivezPost, CanalCupEvent } from "@/lib/supabase/types";
import {
  EVENT_CONFIGS,
  DUEL_PHRASES,
  getHypePhrase,
  getHypeLevelBadge,
  formatCountdown,
  formatNCTime,
  type EventType,
} from "@/lib/tv/hype";

type Slide = "upcoming" | "classement" | "match" | "duel" | "standings" | "matinale" | "revivez";

const SLIDE_DURATION = 12000;
const REFRESH_INTERVAL = 30000;
const SLIDES: Slide[] = ["upcoming", "classement", "match", "duel", "standings", "matinale", "revivez"];

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

interface TVData {
  matches: Match[];
  leaderboard: LeaderboardRow[];
  brief: MorningBrief;
  revivezPosts: RevivezPost[];
  standings?: StandingRow[];
  events?: CanalCupEvent[];
  ambiance?: AmbianceState | null;
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
          ? "text-red-400 animate-pulse text-5xl"
          : "text-canal-yellow text-4xl"
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
          robert_phrase: null,
          location: matchWeek.channel,
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
      <div className="flex flex-col h-full justify-center items-center px-20 py-12">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-6">
          ⏳ PROCHAINS MOMENTS CANAL CUP
        </p>
        <p className="text-canal-gray-muted text-2xl text-center max-w-xl">
          Aucun événement prévu pour l'instant.
          <br />
          Le calme avant la tempête.
        </p>
        <p className="text-canal-gray-muted text-xl mt-4 italic">
          "Robert aussi attend. Avec impatience et professionnalisme."
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-center px-16 py-8 space-y-6">
      <div className="mb-2">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest">
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
            className={`flex items-start gap-6 p-5 rounded-2xl border transition-all ${
              isUrgent
                ? "bg-red-950/30 border-red-500/40"
                : isPast
                ? "bg-canal-gray/30 border-canal-gray-light/20 opacity-60"
                : "bg-canal-gray-mid/40 border-canal-gray-light/30"
            }`}
          >
            {/* Left: emoji + time */}
            <div className="flex flex-col items-center gap-2 shrink-0 w-28">
              <span className="text-5xl">{config.emoji}</span>
              {!isPast ? (
                <LiveCountdown targetIso={event.starts_at} isUrgent={isUrgent} />
              ) : (
                <span className="text-canal-gray-muted text-2xl font-bold">En cours</span>
              )}
              <span className="text-canal-gray-muted text-lg">{timeLabel} NC</span>
            </div>

            {/* Right: content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <p className="font-black text-white text-3xl uppercase tracking-wide">
                  {event.title || config.label}
                </p>
                <span className={`text-lg font-bold ${badge.colorClass}`}>{badge.label}</span>
              </div>

              {event.teams && event.teams.length > 0 && (
                <p className="text-canal-yellow text-xl font-bold mb-1">
                  {event.teams.join(" vs ")}
                </p>
              )}

              {event.location && (
                <p className="text-canal-gray-muted text-lg mb-2">📍 {event.location}</p>
              )}

              <p className="text-canal-gray-muted text-xl italic leading-snug">
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
      location: m.channel,
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
    <div className="flex flex-col h-full justify-center px-20 py-10">
      <div className="mb-8">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-1">
          📅 PLANNING DU JOUR
        </p>
        <p className="text-canal-gray-muted text-xl capitalize">{dateLabel} — Heure NC</p>
        <div className="h-1 w-40 bg-canal-yellow mt-3" />
      </div>

      {!allItems.length ? (
        <p className="text-canal-gray-muted text-2xl italic">
          "Rien de prévu. Canal Cup ne fait pas de pause, lui."
        </p>
      ) : (
        <div className="space-y-4">
          {allItems.map((item) => {
            const t = new Date(item.starts_at).getTime();
            const isPast = t < now - 15 * 60_000;
            const isCurrent = !isPast && t < now + 15 * 60_000;
            const msLeft = t - now;
            const config = EVENT_CONFIGS[item.type as EventType] ?? EVENT_CONFIGS.custom;

            return (
              <div
                key={item.id}
                className={`flex items-center gap-6 py-3 border-l-4 pl-6 transition-all ${
                  isCurrent
                    ? "border-canal-yellow"
                    : isPast
                    ? "border-canal-gray-light/30 opacity-40"
                    : "border-canal-gray-light/50"
                }`}
              >
                <span
                  className={`font-black text-2xl w-20 ${
                    isCurrent ? "text-canal-yellow" : isPast ? "text-canal-gray-muted" : "text-white"
                  }`}
                >
                  {formatNCTime(item.starts_at)}
                </span>
                <span className="text-3xl">{config.emoji}</span>
                <div className="flex-1">
                  <p
                    className={`font-black text-2xl ${
                      isCurrent ? "text-white" : isPast ? "text-canal-gray-muted" : "text-white"
                    }`}
                  >
                    {item.title}
                  </p>
                  {item.location && (
                    <p className="text-canal-gray-muted text-lg">{item.location}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {isPast ? (
                    <span className="text-canal-gray-muted text-xl">✓ Terminé</span>
                  ) : isCurrent ? (
                    <span className="text-canal-yellow font-black text-xl animate-pulse">← MAINTENANT</span>
                  ) : (
                    <span className="text-canal-gray-muted text-xl">
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
    <div className="flex flex-col h-full justify-center px-20 py-12">
      <div className="mb-8">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-2">
          ⚔️ DUEL DU TOURNOI
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>

      <div className="flex items-center gap-12 mb-10">
        {/* Team 1 */}
        <div className="flex-1 text-center">
          <p className="text-canal-gray-muted text-xl uppercase tracking-wider mb-3">🥇 EN TÊTE</p>
          <p className="font-black text-5xl text-white mb-3">{first.team.name}</p>
          <p className="text-canal-gray-muted text-xl italic mb-4">{first.team.slogan}</p>
          <p className="font-black text-8xl text-canal-yellow">{first.total}</p>
          <p className="text-canal-gray-muted text-xl mt-1">points</p>
        </div>

        {/* VS */}
        <div className="flex flex-col items-center gap-3 shrink-0">
          <span className="font-black text-5xl text-canal-gray-muted">VS</span>
          <div className="flex flex-col items-center">
            <span className="text-canal-gray-muted text-lg">Écart</span>
            <span
              className={`font-black text-4xl ${
                gap <= 5 ? "text-red-400" : gap <= 15 ? "text-orange-400" : "text-canal-gray-muted"
              }`}
            >
              {gap > 0 ? `+${gap}` : gap}
            </span>
            <span className="text-canal-gray-muted text-lg">pts</span>
          </div>
        </div>

        {/* Team 2 */}
        <div className="flex-1 text-center">
          <p className="text-canal-gray-muted text-xl uppercase tracking-wider mb-3">🥈 POURSUIT</p>
          <p className="font-black text-5xl text-white mb-3">{second.team.name}</p>
          <p className="text-canal-gray-muted text-xl italic mb-4">{second.team.slogan}</p>
          <p className="font-black text-8xl text-white">{second.total}</p>
          <p className="text-canal-gray-muted text-xl mt-1">points</p>
        </div>
      </div>

      <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-6 text-center">
        <p className="text-canal-gray-muted text-xl italic">"{phrase}"</p>
      </div>
    </div>
  );
}

// ─── Slide: Classement ───────────────────────────────────────────────────────

function SlideClassement({ leaderboard }: { leaderboard: LeaderboardRow[] }) {
  const sorted = [...leaderboard].sort((a, b) => b.total - a.total).slice(0, 3);
  return (
    <div className="flex flex-col h-full justify-center px-20 py-12">
      <div className="mb-8">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-2">
          Classement Général
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="space-y-6">
        {sorted.map((row, i) => (
          <div key={row.team.id} className="flex items-center gap-8">
            <span className="text-5xl w-16">{i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}</span>
            <div className="flex-1">
              <p className="font-black text-4xl text-white">{row.team.name}</p>
              <p className="text-canal-gray-muted text-xl italic">{row.team.slogan}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-6xl text-canal-yellow">{row.total}</p>
              <p className="text-canal-gray-muted text-xl">points</p>
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
    <div className="flex flex-col h-full justify-center items-center px-20 py-12">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-12">
        {match.status === "live" ? "🔴 En Direct" : "⚽ Prochain Match"}
      </p>
      <div className="flex items-center gap-16 w-full justify-center">
        <div className="flex flex-col items-center gap-4">
          <span className="text-8xl">{flagEmoji(match.flag_a ?? match.team_a)}</span>
          <p className="font-black text-4xl text-white">{match.team_a}</p>
        </div>
        <div className="flex flex-col items-center gap-2">
          {match.status !== "upcoming" ? (
            <div className="flex gap-4 items-center">
              <span className="font-black text-8xl text-canal-yellow">{match.score_a ?? 0}</span>
              <span className="font-black text-5xl text-canal-gray-muted">–</span>
              <span className="font-black text-8xl text-canal-yellow">{match.score_b ?? 0}</span>
            </div>
          ) : (
            <span className="font-black text-6xl text-canal-gray-muted">VS</span>
          )}
          <p className="text-canal-gray-muted text-xl">
            {toNCDate(match.starts_at)} — {toNCTime(match.starts_at)} NC
          </p>
          <div className="canal-badge text-lg px-4 py-1">{match.channel}</div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <span className="text-8xl">{flagEmoji(match.flag_b ?? match.team_b)}</span>
          <p className="font-black text-4xl text-white">{match.team_b}</p>
        </div>
      </div>
      {match.is_match_of_week && (
        <div className="mt-12 canal-badge text-xl px-6 py-2">⭐ Match de la semaine</div>
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
        <p className="text-canal-gray-muted text-2xl">Classement disponible dès le début du tournoi</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full justify-center px-12 py-8">
      <div className="mb-6">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-2">
          ⚽ Classement FIFA WC 2026
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="grid grid-cols-2 gap-8">
        {groups.map(([groupName, rows]) => {
          const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);
          return (
            <div key={groupName}>
              <p className="text-canal-yellow font-black text-lg mb-3 uppercase">{groupName}</p>
              <div className="space-y-2">
                {sorted.slice(0, 4).map((row, i) => (
                  <div
                    key={row.team_name_fr}
                    className={`flex items-center gap-3 ${i < 2 ? "text-white" : "text-canal-gray-muted"}`}
                  >
                    <span className="w-5 text-center font-bold text-lg">{i + 1}</span>
                    <span className="text-2xl">{row.team_flag}</span>
                    <span className={`flex-1 text-xl ${i < 2 ? "font-bold" : ""}`}>{row.team_name_fr}</span>
                    <span className="font-black text-2xl text-canal-yellow">{row.points}</span>
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
    <div className="flex flex-col h-full justify-center px-20 py-12">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-4">
        📰 Matinale du {toNCDate(brief.date)}
      </p>
      <h2 className="font-black text-5xl text-white leading-tight mb-8">{brief.title}</h2>
      <p className="text-canal-gray-muted text-2xl leading-relaxed mb-8 max-w-4xl">{brief.body}</p>
      {brief.fail_of_day && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6">
          <p className="text-red-400 font-bold text-xl mb-2">💥 Fail du jour</p>
          <p className="text-white text-2xl italic">"{brief.fail_of_day}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Slide: Revivez ──────────────────────────────────────────────────────────

function SlideRevivez({ posts }: { posts: RevivezPost[] }) {
  const post = posts[Math.floor(Math.random() * posts.length)];
  if (!post) return null;
  return (
    <div className="flex flex-col h-full justify-center items-center px-20 py-12 text-center">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-8">
        💬 Revivez — Les Archives du VAR
      </p>
      <div className="max-w-4xl">
        <p className="font-black text-3xl text-canal-gray-muted uppercase mb-6">{post.title}</p>
        <p className="text-white text-4xl leading-relaxed italic font-medium">"{post.content}"</p>
        {post.team && (
          <p className="text-canal-yellow text-xl mt-8 font-bold">— {post.team.name}</p>
        )}
        <p className="text-canal-gray-muted text-lg mt-4">❤️ {post.votes_count} votes</p>
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

  useEffect(() => {
    const t = setInterval(
      () => setCurrentSlide((i) => (i + 1) % SLIDES.length),
      SLIDE_DURATION
    );
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <PinGate>
    <div className="fixed inset-0 bg-canal-black flex flex-col overflow-hidden tv-mode">
      {/* Header */}
      <header className="flex items-center justify-between px-12 py-4 border-b border-canal-gray-light shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-canal-yellow font-black text-3xl tracking-tight">CANAL</span>
          <span className="text-white font-black text-3xl tracking-tight">CUP</span>
          <span className="text-canal-gray-muted text-3xl font-bold">2026</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-canal-gray-muted text-sm">Heure NC</p>
            <LiveClock />
          </div>
          <div className="w-px h-10 bg-canal-gray-light" />
          <div className="flex flex-col items-center gap-1">
            <QrCode size={40} className="text-canal-gray-muted" />
            <p className="text-xs text-canal-gray-muted">Scannez</p>
          </div>
        </div>
      </header>

      {/* Ambiance Banner — permanent quand un match est en direct */}
      {data?.ambiance && <AmbianceBanner ambiance={data.ambiance} />}

      {/* Slide area */}
      <div className="flex-1 animate-fade-in overflow-hidden" key={currentSlide}>
        {!data ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-canal-gray-muted text-2xl">Chargement…</p>
          </div>
        ) : (
          <>
            {slide === "upcoming" && (
              <SlideUpcoming events={data.events ?? []} matches={data.matches} />
            )}
            {slide === "classement" && <SlideClassement leaderboard={data.leaderboard} />}
            {slide === "match" && <SlideMatch matches={data.matches} />}
            {slide === "duel" && <SlideDuel leaderboard={data.leaderboard} />}
            {slide === "standings" && <SlideStandings standings={data.standings ?? []} />}
            {slide === "matinale" && <SlideMatinale brief={data.brief} />}
            {slide === "revivez" && <SlideRevivez posts={data.revivezPosts} />}
          </>
        )}
      </div>

      {/* Footer dots */}
      <footer className="flex items-center justify-center gap-3 pb-8 shrink-0">
        {SLIDES.map((s, i) => (
          <button
            key={s}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentSlide ? "w-8 bg-canal-yellow" : "w-2 bg-canal-gray-light"
            }`}
          />
        ))}
      </footer>
    </div>
    </PinGate>
  );
}
