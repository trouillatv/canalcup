"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { toNCDate, toNCTime } from "@/lib/utils";
import { Flag } from "@/components/shared/Flag";
import { QrCode, Maximize2, Minimize2 } from "lucide-react";
import type { Match, LeaderboardRow, MorningBrief, RevivezPost, CanalCupEvent, Challenge } from "@/lib/supabase/types";
import type { IndividualRow } from "@/lib/data/teams";
import type { ServiceLeaderboardRow } from "@/lib/data/users";
import type { Medal } from "@/lib/data/medals";
import type { TvHeatmapRow } from "@/lib/data/player";
import type { HallOfShameData, VisionnaireData, DramaData } from "@/lib/data/tv-stories";
import type { PredictionOutcome } from "@/lib/scoring";
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
  getGoatPreMatchPhrase,
  getSalonPhrase,
  SALON_PREMATCH,
} from "@/lib/tv/hype";

type Slide =
  | "upcoming"
  | "match"
  | "livematch"
  | "standings"
  | "bracket"
  | "matinale"
  | "revivez"
  | "prematch"
  | "animations"
  | "general"
  | "quiz"
  | "services"
  | "medals"
  | "playerofday"
  | "news"
  | "robert"
  | "fail"
  | "officebet"
  | "tightrace"
  | "welcome"
  | "topscorerrace"
  | "hallofshame"
  | "visionnaire"
  | "drama"
  | "fantomes"
  | "squads"
  | "notifcta"
  | "scoregap"
  | "results";

// ─── Goat helper: remplace "Le Goat" par l'image de chèvre ────────────────────

function withGoat(text: string): React.ReactNode {
  const parts = text.split("Le Goat");
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <img
              src="/goat.png"
              alt="🐐"
              className="inline h-[1em] object-contain align-middle mx-0.5"
            />
          )}
        </React.Fragment>
      ))}
    </>
  );
}

// ─── QR Context: URL et message contextuel selon la slide active ──────────────

interface QRContext {
  url: string;
  message: string;
  subtext: string;
}

function getQRContext(slide: Slide, data: TVData | null, origin: string): QRContext {
  if (slide === "prematch" || slide === "officebet") {
    const match = data?.prematch?.match;
    return {
      url: `${origin}/predictions`,
      message: "⚽ Faites votre pronostic",
      subtext: match ? `${match.team_a} — ${match.team_b}` : "Votre prono du match",
    };
  }
  if (slide === "quiz") {
    return { url: `${origin}/quiz-live`, message: "🧠 Quiz en cours", subtext: "Répondez sur votre mobile" };
  }
  if (slide === "animations") {
    return { url: `${origin}/animations`, message: "🎉 Animation", subtext: "Participez maintenant" };
  }
  if (slide === "livematch") {
    return { url: `${origin}/`, message: "⚡ Live en cours", subtext: "Suivez sur votre mobile" };
  }
  if (["general", "tightrace", "services"].includes(slide)) {
    return { url: `${origin}/classement`, message: "🏆 Classement", subtext: "Votre position ?" };
  }
  if (slide === "matinale") {
    return { url: `${origin}/matinale`, message: "☀️ Brief du jour", subtext: "Tout Canal Cup" };
  }
  return { url: `${origin}/`, message: "📱 Canal Cup 2026", subtext: "Scannez & jouez" };
}

const SLIDE_DURATION = 12000;

// Slides « thématiquement match » — à ne pas enchaîner (sinon ça donne
// l'impression de « 3 écrans prochains matchs de suite »).
const MATCH_THEME = new Set<Slide>(["prematch", "squads", "match", "results", "scoregap", "livematch", "upcoming", "officebet"]);
function slideTheme(s: Slide): string {
  return MATCH_THEME.has(s) ? "match" : s;
}
// Mélange (Fisher-Yates) + réagencement glouton : aucune slide de même thème ne
// se suit. Évite « 3 Goat / 3 notifs / 3 matchs d'affilée ».
function arrangeSlides(list: Slide[]): Slide[] {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const out: Slide[] = [];
  const rest = [...arr];
  while (rest.length) {
    const lastTheme = out.length ? slideTheme(out[out.length - 1]) : null;
    let idx = rest.findIndex((s) => slideTheme(s) !== lastTheme);
    if (idx === -1) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}
const REFRESH_INTERVAL = 30000;
const FLASH_POLL_INTERVAL = 10000;
// Rotation salon : on alterne sport / classements / fun pour varier le rythme.
// "animations" et toute slide vide sont filtrées dynamiquement (voir TVPage).
const BASE_SLIDES: Slide[] = [
  "prematch",      // analyse pré-match
  "squads",        // effectifs des équipes du jour
  "general",       // classement individuel global
  "officebet",     // distribution pronos V/N/D
  "match",         // matchs du jour
  "results",       // résultats + buteurs du jour
  "scoregap",      // clash : plus gros écart du jour (on chambre le perdant)
  "hallofshame",   // pires pronos du dernier match
  "playerofday",   // meilleur joueur individuel
  "visionnaire",   // score exact trouvé
  "robert",        // 🐐 dit…
  "standings",     // groupes FIFA
  "tightrace",     // course serrée
  "drama",         // plus grand gain de points 24h
  "livematch",     // match en direct
  "animations",    // défis RSE
  "quiz",          // champions du quiz
  "topscorerrace", // paris meilleur buteur
  "services",      // classement services
  "welcome",       // nouveaux joueurs
  "fantomes",      // joueurs inactifs
  "bracket",       // phase à élimination
  "medals",        // médailles absurdes
  "upcoming",      // prochains événements
  "matinale",      // brief matinal
  "fail",          // fail du jour
  "news",          // RSS foot
  "revivez",       // archives
];

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
  brief: MorningBrief | null;
  revivezPosts: RevivezPost[];
  challenges?: Challenge[];
  standings?: StandingRow[];
  events?: CanalCupEvent[];
  ambiance?: AmbianceState | null;
  prematch?: PreMatchStats | null;
  individual?: IndividualRow[];
  services?: ServiceLeaderboardRow[];
  medals?: Medal[];
  news?: { title: string; link: string }[];
  todayStats?: { pronos: number; quiz: number; animations: number };
  newPlayers?: string[];
  topScorerBets?: { name: string; count: number }[];
  heatmap?: TvHeatmapRow[];
  hallofshame?: HallOfShameData | null;
  visionnaire?: VisionnaireData | null;
  drama?: DramaData | null;
  fantomes?: string[];
  matchEvents?: MatchEventEntry[];
}

interface MatchEventEntry {
  match_id: string;
  team_side: string;
  player_name: string | null;
  type: string;
  minute: number | null;
  extra_minute: number | null;
  detail: string | null;
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
          "Le Goat aussi attend. Avec impatience et professionnalisme."
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

// ─── Slide: Duel des pronos (top 2 pronostiqueurs face à face) ────────────────
function SlideDuelPronos({ individual }: { individual: IndividualRow[] }) {
  const sorted = [...individual].sort((a, b) => b.pronos - a.pronos);
  if (sorted.length < 2 || sorted[0].pronos <= 0) return null;
  const [first, second] = sorted;
  const gap = first.pronos - second.pronos;

  return (
    <div className="flex flex-col justify-center px-4 sm:px-8 lg:px-20 py-4 sm:py-12">
      <div className="mb-3 sm:mb-8">
        <p className="text-canal-yellow font-black text-sm sm:text-2xl uppercase tracking-widest mb-2">
          🎯 DUEL DES PRONOS
        </p>
        <div className="h-1 w-24 sm:w-32 bg-canal-yellow" />
      </div>

      <div className="flex items-center gap-2 sm:gap-12 mb-4 sm:mb-10">
        <div className="flex-1 min-w-0 text-center">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase tracking-wider mb-1 sm:mb-3">🥇 EN TÊTE</p>
          <p className="font-black text-base sm:text-4xl lg:text-5xl text-white mb-1 sm:mb-3 leading-tight break-words">{first.display_name}</p>
          <p className="font-black text-3xl sm:text-5xl lg:text-8xl text-canal-yellow">{first.pronos}</p>
          <p className="text-canal-gray-muted text-xs sm:text-xl mt-0.5">pts pronos</p>
        </div>

        <div className="flex flex-col items-center gap-1 sm:gap-3 shrink-0">
          <span className="font-black text-lg sm:text-4xl lg:text-5xl text-canal-gray-muted">VS</span>
          <div className="flex flex-col items-center">
            <span className="text-canal-gray-muted text-xs sm:text-lg">Écart</span>
            <span className={`font-black text-lg sm:text-3xl lg:text-4xl ${gap <= 5 ? "text-red-400" : gap <= 15 ? "text-orange-400" : "text-canal-gray-muted"}`}>
              {gap > 0 ? `+${gap}` : gap}
            </span>
            <span className="text-canal-gray-muted text-xs sm:text-lg">pts</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 text-center">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase tracking-wider mb-1 sm:mb-3">🥈 POURSUIT</p>
          <p className="font-black text-base sm:text-4xl lg:text-5xl text-white mb-1 sm:mb-3 leading-tight break-words">{second.display_name}</p>
          <p className="font-black text-3xl sm:text-5xl lg:text-8xl text-white">{second.pronos}</p>
          <p className="text-canal-gray-muted text-xs sm:text-xl mt-0.5">pts pronos</p>
        </div>
      </div>

      <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-3 sm:p-6 text-center">
        <p className="text-canal-gray-muted text-xs sm:text-xl italic">Qui sera le meilleur pronostiqueur de la Canal Cup ?</p>
      </div>
    </div>
  );
}

// ─── Slide: Classement ───────────────────────────────────────────────────────

function SlideClassement({ leaderboard }: { leaderboard: LeaderboardRow[] }) {
  // Toutes les équipes (plus de cap à 3). On adapte la taille des lignes au
  // nombre d'équipes pour rester lisible sans déborder de l'écran salon :
  // ≤3 = grand, 4-6 = moyen, >6 = compact (+ scroll de sécurité).
  const sorted = [...leaderboard].sort((a, b) => b.total - a.total);
  const dense = sorted.length > 6;
  const medium = sorted.length > 3 && !dense;
  const nameSize = dense
    ? "text-base sm:text-xl lg:text-2xl"
    : medium
    ? "text-lg sm:text-2xl lg:text-3xl"
    : "text-lg sm:text-3xl lg:text-4xl";
  const ptsSize = dense
    ? "text-xl sm:text-3xl lg:text-4xl"
    : medium
    ? "text-2xl sm:text-4xl lg:text-5xl"
    : "text-2xl sm:text-5xl lg:text-6xl";
  const rankSize = dense ? "text-xl sm:text-3xl" : "text-2xl sm:text-5xl";
  const rowGap = dense ? "space-y-2 sm:space-y-2.5" : medium ? "space-y-2 sm:space-y-4" : "space-y-3 sm:space-y-6";
  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <div className="mb-3 sm:mb-6 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">
          Classement Binômes
        </p>
        <p className="text-canal-gray-muted text-sm sm:text-lg mb-2">Babyfoot + animations</p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className={`${rowGap} overflow-y-auto`}>
        {sorted.map((row, i) => (
          <div key={row.team.id} className="flex items-center gap-3 sm:gap-8">
            <span className={`${rankSize} w-8 sm:w-16 shrink-0 text-center font-black ${i > 2 ? "text-canal-gray-muted" : ""}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-black ${nameSize} text-white truncate`}>{row.team.name}</p>
              {!dense && (
                <p className="text-canal-gray-muted text-xs sm:text-xl italic truncate">{row.team.slogan}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black ${ptsSize} text-canal-yellow`}>{row.total}</p>
              {!dense && <p className="text-canal-gray-muted text-xs sm:text-xl">points</p>}
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
          <Flag flag={match.flag_a} name={match.team_a} className="h-9 sm:h-14 lg:h-20 w-auto rounded-sm" emojiClassName="text-4xl sm:text-6xl lg:text-8xl" />
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
          <Flag flag={match.flag_b} name={match.team_b} className="h-9 sm:h-14 lg:h-20 w-auto rounded-sm" emojiClassName="text-4xl sm:text-6xl lg:text-8xl" />
          <p className="font-black text-sm sm:text-3xl lg:text-4xl text-white text-center break-words leading-tight">{match.team_b}</p>
        </div>
      </div>
      {match.is_match_of_week && (
        <div className="mt-6 sm:mt-12 canal-badge text-base sm:text-xl px-4 sm:px-6 py-2">⭐ Match de la semaine</div>
      )}
    </div>
  );
}

// ─── Slide: Résultats du jour ─────────────────────────────────────────────────

function SlideResults({ matches, matchEvents }: { matches: Match[]; matchEvents: MatchEventEntry[] }) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const todayMatches = matches
    .filter((m) => {
      const t = new Date(m.starts_at).getTime();
      return t >= todayStart.getTime() && t <= todayEnd.getTime();
    })
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());

  if (!todayMatches.length) return null;

  // Grouped events by match
  const eventsByMatch = new Map<string, MatchEventEntry[]>();
  for (const e of matchEvents) {
    if (!eventsByMatch.has(e.match_id)) eventsByMatch.set(e.match_id, []);
    eventsByMatch.get(e.match_id)!.push(e);
  }

  const buildScorers = (matchId: string): { home: string[]; away: string[] } => {
    const evts = (eventsByMatch.get(matchId) ?? []).sort(
      (a, b) => (a.minute ?? 0) - (b.minute ?? 0)
    );
    const home: string[] = [];
    const away: string[] = [];
    for (const e of evts) {
      const isOwn = (e.detail ?? "").toLowerCase().includes("own");
      const side = isOwn ? (e.team_side === "home" ? "away" : "home") : e.team_side;
      const min = `${e.minute ?? "?"}${e.extra_minute ? `+${e.extra_minute}` : ""}′`;
      const label = `${e.player_name ?? "?"}  ${min}${isOwn ? " (csc)" : e.type === "penalty" ? " (p)" : ""}`;
      if (side === "home") home.push(label);
      else away.push(label);
    }
    return { home, away };
  };

  const cols =
    todayMatches.length === 1 ? "grid-cols-1 max-w-xl mx-auto" :
    todayMatches.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
    todayMatches.length === 3 ? "grid-cols-1 sm:grid-cols-3" :
    "grid-cols-2";

  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-10 py-3 sm:py-4">
      <div className="mb-2 sm:mb-3 shrink-0">
        <p className="text-canal-yellow font-black text-base sm:text-xl uppercase tracking-widest">
          📅 Matchs du jour
        </p>
        <div className="h-0.5 w-20 bg-canal-yellow mt-1" />
      </div>

      <div className={`flex-1 grid gap-2 sm:gap-3 content-center ${cols} w-full`}>
        {todayMatches.map((m) => {
          const isLive = m.status === "live";
          const isHalf = m.status === "halftime";
          const isFinished = m.status === "finished";
          const hasScore = !isLive && !isHalf ? isFinished : true;
          const scorers = hasScore ? buildScorers(m.id) : null;

          return (
            <div
              key={m.id}
              className={`rounded-2xl border px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col gap-2 ${
                isLive || isHalf
                  ? "border-red-500/40 bg-red-950/20"
                  : isFinished
                  ? "border-canal-gray-light/30 bg-canal-gray-mid/20"
                  : "border-canal-gray-light/20 bg-canal-gray-mid/10"
              }`}
            >
              {/* Status badge */}
              <div className="flex items-center justify-between gap-2">
                {isLive && (
                  <span className="flex items-center gap-1 text-[10px] sm:text-xs font-black text-red-400 uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                    {(m as Match & { minute?: number }).minute ? `LIVE ${(m as Match & { minute?: number }).minute}′` : "LIVE"}
                  </span>
                )}
                {isHalf && <span className="text-[10px] sm:text-xs font-black text-orange-400 uppercase tracking-widest">MI-TEMPS</span>}
                {isFinished && <span className="text-[10px] sm:text-xs font-bold text-canal-gray-muted uppercase">TERMINÉ</span>}
                {!isLive && !isHalf && !isFinished && (
                  <span className="text-[10px] sm:text-xs font-bold text-canal-yellow">{toNCTime(m.starts_at)} NC</span>
                )}
                {m.stage && <span className="text-[9px] sm:text-[10px] text-canal-gray-muted shrink-0">{m.stage}</span>}
              </div>

              {/* Team A */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag flag={m.flag_a} name={m.team_a} className="h-3.5 w-auto rounded-sm shrink-0" emojiClassName="text-sm shrink-0" />
                    <span className={`font-bold text-sm sm:text-base truncate ${isFinished && (m.score_a ?? 0) > (m.score_b ?? 0) ? "text-canal-yellow" : "text-white"}`}>
                      {m.team_a}
                    </span>
                  </div>
                  {(isLive || isHalf || isFinished) && (
                    <span className={`font-black text-xl sm:text-2xl tabular-nums shrink-0 ${isFinished && (m.score_a ?? 0) > (m.score_b ?? 0) ? "text-canal-yellow" : "text-white"}`}>
                      {m.score_a ?? 0}
                    </span>
                  )}
                </div>
                {scorers?.home && scorers.home.length > 0 && (
                  <p className="text-[10px] sm:text-xs text-canal-gray-muted pl-5 leading-snug mt-0.5">
                    {scorers.home.map((s, i) => (
                      <span key={i}>{i > 0 && <span className="mx-1 opacity-40">·</span>}⚽ {s}</span>
                    ))}
                  </p>
                )}
              </div>

              {/* Team B */}
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag flag={m.flag_b} name={m.team_b} className="h-3.5 w-auto rounded-sm shrink-0" emojiClassName="text-sm shrink-0" />
                    <span className={`font-bold text-sm sm:text-base truncate ${isFinished && (m.score_b ?? 0) > (m.score_a ?? 0) ? "text-canal-yellow" : "text-white"}`}>
                      {m.team_b}
                    </span>
                  </div>
                  {(isLive || isHalf || isFinished) && (
                    <span className={`font-black text-xl sm:text-2xl tabular-nums shrink-0 ${isFinished && (m.score_b ?? 0) > (m.score_a ?? 0) ? "text-canal-yellow" : "text-white"}`}>
                      {m.score_b ?? 0}
                    </span>
                  )}
                </div>
                {scorers?.away && scorers.away.length > 0 && (
                  <p className="text-[10px] sm:text-xs text-canal-gray-muted pl-5 leading-snug mt-0.5">
                    {scorers.away.map((s, i) => (
                      <span key={i}>{i > 0 && <span className="mx-1 opacity-40">·</span>}⚽ {s}</span>
                    ))}
                  </p>
                )}
              </div>

              {/* No score yet placeholder */}
              {(isLive || isHalf) && !scorers?.home.length && !scorers?.away.length && (
                <p className="text-[10px] text-canal-gray-muted text-center italic">Aucun but pour l&apos;instant</p>
              )}
            </div>
          );
        })}
      </div>
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
          <Flag flag={target.flag_a} name={target.team_a} className="h-9 sm:h-16 lg:h-20 w-auto rounded-sm" emojiClassName="text-4xl sm:text-7xl lg:text-8xl" />
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
          <Flag flag={target.flag_b} name={target.team_b} className="h-9 sm:h-16 lg:h-20 w-auto rounded-sm" emojiClassName="text-4xl sm:text-7xl lg:text-8xl" />
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
  // TOUS les groupes (A..L), triés par nom. Grille compacte multi-colonnes qui
  // tient à l'écran ; overflow-y-auto en sécurité si beaucoup de groupes.
  const groups = Object.entries(byGroup).sort(([a], [b]) => a.localeCompare(b));

  if (groups.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-canal-gray-muted text-xl sm:text-2xl">Classement disponible dès le début du tournoi</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-10 py-2 sm:py-3 overflow-hidden">
      <div className="mb-2 shrink-0">
        <p className="text-canal-yellow font-black text-base sm:text-lg uppercase tracking-widest mb-1">
          ⚽ Classement FIFA WC 2026
        </p>
        <div className="h-1 w-20 sm:w-24 bg-canal-yellow" />
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-2 sm:gap-x-4 gap-y-2 sm:gap-y-3 content-start overflow-hidden">
        {groups.map(([groupName, rows]) => {
          const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);
          return (
            <div key={groupName} className="min-w-0 rounded-xl border border-canal-gray-light/20 bg-canal-gray-mid/15 px-2 py-1.5 sm:px-2.5 sm:py-2">
              <p className="text-canal-yellow font-black text-[9px] sm:text-[10px] mb-1 uppercase tracking-wider">Groupe {groupName}</p>
              <div className="space-y-0.5">
                {sorted.slice(0, 4).map((row, i) => (
                  <div
                    key={row.team_name_fr}
                    className={`flex items-center gap-1 ${i < 2 ? "text-white" : "text-canal-gray-muted"}`}
                  >
                    <span className="w-3 text-center font-bold text-[8px] sm:text-[10px] shrink-0">{i + 1}</span>
                    <Flag flag={row.team_flag} name={row.team_name_fr} className="h-3 w-auto rounded-sm shrink-0" emojiClassName="text-[9px] sm:text-[10px] shrink-0" />
                    <span className={`flex-1 min-w-0 truncate text-[9px] sm:text-[10px] ${i < 2 ? "font-bold" : ""}`}>{row.team_name_fr}</span>
                    <span className="font-black text-[9px] sm:text-[10px] text-canal-yellow shrink-0 tabular-nums">{row.points}</span>
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
                  <Flag flag={match.flag_a} name={match.team_a} className="h-7 sm:h-11 w-auto rounded-sm block mx-auto mb-1 sm:mb-2" emojiClassName="text-3xl sm:text-5xl block mb-1 sm:mb-2 leading-none" />
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
                  <Flag flag={match.flag_b} name={match.team_b} className="h-7 sm:h-11 w-auto rounded-sm block mx-auto mb-1 sm:mb-2" emojiClassName="text-3xl sm:text-5xl block mb-1 sm:mb-2 leading-none" />
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
interface DossierPlayer { name: string; position: string | null; club: string | null }
interface DossierTeam {
  name: string;
  form: string[];
  formCodes: ("V" | "N" | "D" | "?")[];
  recentScores: string[];
  keyPlayers: DossierPlayer[];
  keyPlayersByPos?: { gk: DossierPlayer[]; def: DossierPlayer[]; mid: DossierPlayer[]; fwd: DossierPlayer[] };
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
          <Flag flag={flagA} name={teamA} className="h-6 sm:h-9 w-auto rounded-sm" emojiClassName="text-2xl sm:text-4xl" />
          <span className="text-canal-gray-muted font-black text-xs sm:text-lg">VS</span>
          <Flag flag={flagB} name={teamB} className="h-6 sm:h-9 w-auto rounded-sm" emojiClassName="text-2xl sm:text-4xl" />
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
  const goatCtx = {
    teamA: match.team_a,
    teamB: match.team_b,
    topResult: stats.top_result,
    topPct: stats.top_pct,
    teamsMissing: stats.teams_missing,
    msLeft,
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 sm:px-8 lg:px-16 py-3 sm:py-6 gap-3 sm:gap-4">
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6">
        {/* Team A */}
        <div className="flex-1 text-center min-w-0">
          <Flag flag={match.flag_a} name={match.team_a} className="h-7 sm:h-11 lg:h-14 w-auto rounded-sm block mx-auto mb-1 sm:mb-2" emojiClassName="text-3xl sm:text-5xl lg:text-6xl block mb-1 sm:mb-2 leading-none" />
          <p className="font-black text-base sm:text-2xl lg:text-3xl text-white break-words leading-tight">{match.team_a}</p>
        </div>

        {/* Countdown center */}
        <div className="shrink-0 mx-auto">
          <PreMatchCountdown targetIso={match.starts_at} msLeft={msLeft} />
        </div>

        {/* Team B */}
        <div className="flex-1 text-center min-w-0">
          <Flag flag={match.flag_b} name={match.team_b} className="h-7 sm:h-11 lg:h-14 w-auto rounded-sm block mx-auto mb-1 sm:mb-2" emojiClassName="text-3xl sm:text-5xl lg:text-6xl block mb-1 sm:mb-2 leading-none" />
          <p className="font-black text-base sm:text-2xl lg:text-3xl text-white break-words leading-tight">{match.team_b}</p>
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

      {/* Le Goat quote + salon */}
      <div className="flex items-end justify-between gap-3 sm:gap-6">
        <div className="flex-1 bg-canal-gray-mid/30 border border-canal-gray-light/20 rounded-2xl px-4 sm:px-6 py-3 sm:py-4">
          <p className="text-canal-gray-muted text-base sm:text-xl italic leading-snug">
            &ldquo;{withGoat(getGoatPreMatchPhrase(goatCtx))}&rdquo;
          </p>
          <p className="text-canal-yellow/60 text-sm sm:text-lg mt-1 flex items-center gap-1">
            —{" "}
            <img src="/goat.png" alt="🐐" className="h-[1em] object-contain align-middle" />
          </p>
        </div>
        <p className="text-canal-gray-muted text-base sm:text-xl italic shrink-0 max-w-xs text-right hidden sm:block">{salon}</p>
      </div>
    </div>
  );
}

// ─── Slide : effectifs des équipes jouant aujourd'hui ────────────────────────

const POS_CONFIG = [
  { key: "gk"  as const, label: "GB",  textColor: "text-yellow-400", borderColor: "border-yellow-500/40" },
  { key: "def" as const, label: "DEF", textColor: "text-blue-400",   borderColor: "border-blue-500/40" },
  { key: "mid" as const, label: "MIL", textColor: "text-green-400",  borderColor: "border-green-500/40" },
  { key: "fwd" as const, label: "ATT", textColor: "text-red-400",    borderColor: "border-red-500/40" },
];

function SquadColumn({ team, flagEl }: { team: DossierTeam; flagEl: React.ReactNode }) {
  const byPos = team.keyPlayersByPos;
  return (
    <div className="flex-1 min-w-0 flex flex-col gap-2 sm:gap-3 overflow-hidden">
      {/* Team header */}
      <div className="flex items-center gap-2 sm:gap-3">
        {flagEl}
        <p className="font-black text-base sm:text-2xl text-white truncate">{team.name}</p>
      </div>
      {/* Players by position */}
      <div className="space-y-1.5 sm:space-y-2.5 overflow-y-auto">
        {POS_CONFIG.map(({ key, label, textColor, borderColor }) => {
          const players = byPos?.[key] ?? [];
          if (players.length === 0) return null;
          return (
            <div key={key} className={`border-l-2 ${borderColor} pl-2 sm:pl-3`}>
              <p className={`text-[10px] sm:text-xs font-black uppercase tracking-widest mb-0.5 sm:mb-1 ${textColor}`}>{label}</p>
              {players.map((p) => (
                <div key={p.name} className="flex items-baseline gap-1 sm:gap-2 leading-tight">
                  <span className="text-white font-bold text-xs sm:text-lg truncate">{p.name}</span>
                  {p.club && <span className="text-canal-gray-muted text-[10px] sm:text-sm truncate hidden sm:inline">· {p.club}</span>}
                </div>
              ))}
            </div>
          );
        })}
        {!byPos && team.keyPlayers.map((p) => (
          <p key={p.name} className="text-white text-xs sm:text-lg truncate">{p.name}</p>
        ))}
      </div>
    </div>
  );
}

function SlideTodaySquads({ matches }: { matches: Match[] }) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayUpcoming = matches.filter((m) => {
    const t = new Date(m.starts_at).getTime();
    return t >= todayStart.getTime() && t <= todayEnd.getTime() && m.status === "upcoming";
  });

  const [idx, setIdx] = useState(0);
  const [previews, setPreviews] = useState<Record<string, MatchPreview>>({});

  const matchIds = todayUpcoming.map((m) => m.id).join(",");
  useEffect(() => {
    for (const m of todayUpcoming) {
      if (previews[m.id]) continue;
      fetch(`/api/match-preview/${m.id}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setPreviews((p) => ({ ...p, [m.id]: d })); })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchIds]);

  useEffect(() => {
    if (todayUpcoming.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % todayUpcoming.length), 10000);
    return () => clearInterval(t);
  }, [todayUpcoming.length]);

  if (todayUpcoming.length === 0) return null;

  const match = todayUpcoming[idx % todayUpcoming.length];
  const preview = previews[match.id];

  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-16 py-3 sm:py-5 gap-2 sm:gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <p className="text-canal-yellow font-black text-base sm:text-2xl uppercase tracking-widest">
          🏟️ EFFECTIFS DU JOUR
        </p>
        <p className="text-canal-gray-muted text-xs sm:text-lg">
          {todayUpcoming.length > 1 && `Match ${idx + 1}/${todayUpcoming.length} · `}
          {toNCTime(match.starts_at)} NC
        </p>
      </div>

      {/* VS banner */}
      <div className="flex items-center justify-center gap-3 sm:gap-8 shrink-0">
        <div className="flex items-center gap-2">
          <Flag flag={match.flag_a} name={match.team_a} className="h-5 sm:h-9 w-auto rounded-sm" emojiClassName="text-xl sm:text-4xl" />
          <p className="font-black text-lg sm:text-3xl text-white">{match.team_a}</p>
        </div>
        <span className="text-canal-gray-muted font-black text-base sm:text-2xl">VS</span>
        <div className="flex items-center gap-2">
          <p className="font-black text-lg sm:text-3xl text-white">{match.team_b}</p>
          <Flag flag={match.flag_b} name={match.team_b} className="h-5 sm:h-9 w-auto rounded-sm" emojiClassName="text-xl sm:text-4xl" />
        </div>
      </div>

      {/* Squads */}
      {!preview ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-canal-gray-muted text-xl sm:text-2xl animate-pulse">Chargement des effectifs…</p>
        </div>
      ) : (
        <div className="flex-1 flex gap-3 sm:gap-8 min-h-0 overflow-hidden">
          <SquadColumn
            team={preview.home}
            flagEl={<Flag flag={match.flag_a} name={match.team_a} className="h-5 sm:h-8 w-auto rounded-sm shrink-0" emojiClassName="text-lg sm:text-3xl" />}
          />
          <div className="w-px bg-canal-gray-light/30 shrink-0 self-stretch" />
          <SquadColumn
            team={preview.away}
            flagEl={<Flag flag={match.flag_b} name={match.team_b} className="h-5 sm:h-8 w-auto rounded-sm shrink-0" emojiClassName="text-lg sm:text-3xl" />}
          />
        </div>
      )}

      {todayUpcoming.length > 1 && (
        <div className="flex justify-center gap-1.5 shrink-0">
          {todayUpcoming.map((m, i) => (
            <span key={m.id} className={`h-1.5 rounded-full transition-all ${i === idx % todayUpcoming.length ? "w-6 bg-canal-yellow" : "w-1.5 bg-canal-gray-light"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Composant réutilisable : liste classée (joueurs/services) ───────────────
// Adapte les tailles selon le nombre d'items pour ne jamais déborder de l'écran
// salon (esprit SlideClassement : dense/medium/grand).

interface RankedItem {
  id: string;
  name: string;
  sub?: string | null;
  value: number | string;
  valueUnit?: string;
}

function RankedList({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: RankedItem[];
}) {
  const dense = items.length > 6;
  const medium = items.length > 3 && !dense;
  const nameSize = dense
    ? "text-base sm:text-xl lg:text-2xl"
    : medium
    ? "text-lg sm:text-2xl lg:text-3xl"
    : "text-lg sm:text-3xl lg:text-4xl";
  const valSize = dense
    ? "text-xl sm:text-3xl lg:text-4xl"
    : medium
    ? "text-2xl sm:text-4xl lg:text-5xl"
    : "text-2xl sm:text-5xl lg:text-6xl";
  const rankSize = dense ? "text-xl sm:text-3xl" : "text-2xl sm:text-5xl";
  const rowGap = dense ? "space-y-2 sm:space-y-2.5" : medium ? "space-y-2 sm:space-y-4" : "space-y-3 sm:space-y-6";

  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <div className="mb-3 sm:mb-6 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">{title}</p>
        {subtitle && <p className="text-canal-gray-muted text-sm sm:text-lg mb-2">{subtitle}</p>}
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className={`${rowGap} overflow-y-auto`}>
        {items.map((item, i) => (
          <div key={item.id} className="flex items-center gap-3 sm:gap-8">
            <span className={`${rankSize} w-8 sm:w-16 shrink-0 text-center font-black ${i > 2 ? "text-canal-gray-muted" : ""}`}>
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`font-black ${nameSize} text-white truncate`}>{item.name}</p>
              {!dense && item.sub && (
                <p className="text-canal-gray-muted text-xs sm:text-xl italic truncate">{item.sub}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className={`font-black ${valSize} text-canal-yellow`}>{item.value}</p>
              {!dense && item.valueUnit && <p className="text-canal-gray-muted text-xs sm:text-xl">{item.valueUnit}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide: Classement Général (joueurs, toutes épreuves) ─────────────────────

function SlideGeneral({ individual }: { individual: IndividualRow[] }) {
  const sorted = [...individual].sort((a, b) => b.total - a.total).slice(0, 10);
  return (
    <RankedList
      title="🏆 Classement Général"
      subtitle="Toutes épreuves confondues"
      items={sorted.map((r) => ({
        id: r.user_id,
        name: r.display_name ?? "Anonyme",
        sub: r.team_name,
        value: r.total,
        valueUnit: "pts",
      }))}
    />
  );
}

// ─── Slide: Top Pronostiqueurs ────────────────────────────────────────────────

function SlideTopPronos({ individual }: { individual: IndividualRow[] }) {
  const sorted = [...individual].sort((a, b) => b.pronos - a.pronos).slice(0, 10);
  return (
    <RankedList
      title="🎯 Top Pronostiqueurs"
      subtitle="Les meilleurs au jeu des pronos"
      items={sorted.map((r) => ({
        id: r.user_id,
        name: r.display_name ?? "Anonyme",
        sub: r.team_name,
        value: r.pronos,
        valueUnit: "pts pronos",
      }))}
    />
  );
}

// ─── Slide: Champions du Quiz ─────────────────────────────────────────────────

function SlideQuiz({ individual }: { individual: IndividualRow[] }) {
  const sorted = [...individual].sort((a, b) => b.quiz - a.quiz).slice(0, 10);
  return (
    <RankedList
      title="🧠 Champions du Quiz"
      subtitle="Les cerveaux de la Canal Cup"
      items={sorted.map((r) => ({
        id: r.user_id,
        name: r.display_name ?? "Anonyme",
        sub: r.team_name,
        value: r.quiz,
        valueUnit: "pts quiz",
      }))}
    />
  );
}

// ─── Slide: Bataille des Services ─────────────────────────────────────────────

function SlideServices({ services }: { services: ServiceLeaderboardRow[] }) {
  const sorted = [...services].sort((a, b) => b.average - a.average).slice(0, 10);
  return (
    <RankedList
      title="🏢 Bataille des Services"
      subtitle="Classement à la moyenne par personne"
      items={sorted.map((r) => ({
        id: r.service.id,
        name: r.service.name,
        sub: `${r.total} pts au total`,
        value: r.average,
        valueUnit: `pts/pers · ${r.members} pers.`,
      }))}
    />
  );
}

// ─── Slide: Médailles Absurdes ────────────────────────────────────────────────

function SlideMedals({ medals }: { medals: Medal[] }) {
  const dense = medals.length > 4;
  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6 sm:py-10">
      <div className="mb-3 sm:mb-5 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">
          🏅 Médailles Absurdes
        </p>
        <p className="text-canal-gray-muted text-sm sm:text-lg mb-2">Le palmarès officieux du bureau</p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className={`flex-1 overflow-hidden grid grid-cols-1 ${dense ? "sm:grid-cols-2" : ""} gap-2 sm:gap-3 content-start`}>
        {medals.slice(0, 6).map((medal) => (
          <div
            key={medal.key}
            className="flex items-center gap-3 sm:gap-5 rounded-2xl border border-canal-gray-light/30 bg-canal-gray-mid/40 px-4 sm:px-5 py-3 sm:py-4"
          >
            <span className="text-4xl sm:text-6xl shrink-0">{medal.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-lg sm:text-2xl lg:text-3xl leading-tight">{medal.label}</p>
              <p className="text-canal-yellow text-sm sm:text-xl font-bold truncate">
                {medal.team_name} · {medal.value}
              </p>
              {!dense && (
                <p className="text-canal-gray-muted text-xs sm:text-lg italic mt-0.5 break-words leading-snug">
                  {medal.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Slide: Joueur du jour ────────────────────────────────────────────────────

function SlidePlayerOfDay({ individual }: { individual: IndividualRow[] }) {
  const player = [...individual].sort((a, b) => b.total - a.total)[0];
  if (!player) return null;
  const initials = (player.display_name ?? "?")
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const breakdown = [
    { emoji: "🎯", label: "Pronos", value: player.pronos },
    { emoji: "🧠", label: "Quiz", value: player.quiz },
    { emoji: "⚽", label: "Baby", value: player.babyfoot },
    { emoji: "🎉", label: "Anim.", value: player.animations },
  ];

  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-10">
      <p className="text-canal-yellow font-black text-lg sm:text-2xl uppercase tracking-widest mb-4 sm:mb-8 text-center">
        🔥 Joueur du jour
      </p>
      <div className="flex flex-col items-center gap-3 sm:gap-5 w-full max-w-3xl">
        <div className="flex items-center justify-center w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-canal-yellow text-canal-black font-black text-3xl sm:text-6xl shrink-0">
          {initials || "?"}
        </div>
        <p className="font-black text-2xl sm:text-5xl lg:text-6xl text-white text-center break-words leading-tight">
          {player.display_name ?? "Anonyme"}
        </p>
        {player.team_name && (
          <p className="text-canal-gray-muted text-base sm:text-2xl">{player.team_name}</p>
        )}
        <p className="font-black text-4xl sm:text-7xl text-canal-yellow leading-none">
          {player.total}
          <span className="text-canal-gray-muted text-xl sm:text-3xl font-bold ml-2">pts</span>
        </p>
        <div className="grid grid-cols-4 gap-3 sm:gap-6 w-full mt-2 sm:mt-4">
          {breakdown.map((b) => (
            <div
              key={b.label}
              className="flex flex-col items-center gap-0.5 sm:gap-1 rounded-2xl border border-canal-gray-light/30 bg-canal-gray-mid/40 py-2 sm:py-4"
            >
              <span className="text-2xl sm:text-4xl">{b.emoji}</span>
              <span className="font-black text-lg sm:text-3xl text-white">{b.value}</span>
              <span className="text-canal-gray-muted text-[10px] sm:text-base uppercase tracking-wide">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Slide: Fil L'Équipe (RSS) ────────────────────────────────────────────────

function SlideNews({ news }: { news: { title: string; link: string }[] }) {
  const items = news.slice(0, 5);
  if (!items.length) return null;
  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-20 py-6 sm:py-10">
      <div className="mb-3 sm:mb-6 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2">
          📰 Fil L&apos;Équipe
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="flex-1 overflow-hidden flex flex-col justify-center gap-3 sm:gap-5">
        {items.map((n, i) => (
          <div key={`${i}-${n.title}`} className="flex items-start gap-3 sm:gap-5">
            <span className="text-canal-yellow font-black text-xl sm:text-3xl shrink-0 w-8 sm:w-12 text-center">
              {i + 1}
            </span>
            <p className="font-black text-white text-lg sm:text-2xl lg:text-3xl leading-snug break-words line-clamp-2">
              {n.title}
            </p>
          </div>
        ))}
      </div>
      <p className="text-center text-canal-gray-muted text-sm sm:text-lg mt-3 sm:mt-6 italic shrink-0">
        via L&apos;Équipe
      </p>
    </div>
  );
}

// ─── Slide: Rejoins la Canal Cup (QR géant) ──────────────────────────────────

function SlideJoinQR({ url }: { url: string }) {
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-10 text-center">
      <p className="text-canal-yellow font-black text-2xl sm:text-4xl lg:text-5xl uppercase tracking-widest mb-4 sm:mb-8">
        📣 Rejoins la Canal Cup
      </p>
      {url ? (
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=900x900&margin=10&data=${encodeURIComponent(url)}`}
          alt="QR code Canal Cup"
          className="rounded-2xl bg-white p-3 sm:p-5 w-48 h-48 sm:w-72 sm:h-72 lg:w-96 lg:h-96"
        />
      ) : (
        <QrCode size={200} className="text-canal-gray-muted" />
      )}
      <p className="text-white font-black text-xl sm:text-3xl lg:text-4xl mt-4 sm:mt-8 leading-tight">
        Scanne → Installe → Pronostique
      </p>
      <p className="text-canal-gray-muted text-base sm:text-2xl mt-2 sm:mt-3 italic">
        Premier prono en moins de 2 minutes · Sans téléchargement
      </p>
    </div>
  );
}

// ─── Widget QR permanent (coin bas-droit) ─────────────────────────────────────

function TVQRWidget({ ctx, data }: { ctx: QRContext; data: TVData | null }) {
  const players = data?.individual?.length ?? 0;
  const todayPronos = data?.todayStats?.pronos ?? 0;

  if (!ctx.url) return null;

  return (
    <div className="fixed bottom-16 right-3 sm:bottom-20 sm:right-5 lg:right-8 z-30">
      <div className="bg-canal-black/95 border border-canal-gray-light rounded-2xl p-3 sm:p-4 flex flex-col items-center gap-2 shadow-2xl">
        <p className="text-canal-yellow font-black text-[10px] sm:text-xs text-center uppercase tracking-wider leading-tight max-w-[140px] sm:max-w-[180px]">
          {ctx.message}
        </p>
        <img
          key={ctx.url}
          src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=8&bgcolor=ffffff&color=000000&data=${encodeURIComponent(ctx.url)}`}
          alt="QR code Canal Cup"
          width={180}
          height={180}
          className="rounded-xl bg-white p-1.5 w-28 h-28 sm:w-40 sm:h-40 lg:w-48 lg:h-48 animate-fade-in"
        />
        <p className="text-white/50 text-[9px] sm:text-[10px] text-center leading-tight max-w-[140px] sm:max-w-[180px]">
          {ctx.subtext}
        </p>
        {(players > 0 || todayPronos > 0) && (
          <div className="border-t border-canal-gray-light pt-1.5 flex items-center gap-2 text-[9px] sm:text-[10px] text-canal-gray-muted">
            {players > 0 && <span className="font-bold text-white/70">{players} joueurs</span>}
            {players > 0 && todayPronos > 0 && <span className="opacity-40">·</span>}
            {todayPronos > 0 && <span>{todayPronos} pronos</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Slide: Hall of Shame ────────────────────────────────────────────────────

function SlideHallOfShame({ data }: { data: HallOfShameData }) {
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        💀 Hall of Shame
      </p>
      <p className="text-white/50 text-sm sm:text-xl mb-6 sm:mb-10 italic">{data.match_label}</p>
      <div className="space-y-3 sm:space-y-4 w-full max-w-2xl">
        {data.shame.map((entry) => (
          <div key={entry.name} className="flex items-center gap-4 bg-canal-gray rounded-2xl px-5 sm:px-8 py-3 sm:py-4">
            <span className="text-2xl sm:text-3xl">😬</span>
            <div className="text-left">
              <p className="font-black text-white text-lg sm:text-2xl lg:text-3xl">{entry.name}</p>
              <p className="text-canal-gray-muted text-sm sm:text-lg">avait prédit {entry.predicted}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-canal-yellow/60 text-sm sm:text-lg mt-6 sm:mt-10 flex items-center justify-center gap-2 italic">
        <img src="/goat.png" alt="🐐" className="h-[1em] object-contain" /> compatit. Très professionnellement.
      </p>
    </div>
  );
}

// ─── Slide: Visionnaire ───────────────────────────────────────────────────────

function SlideVisionnaire({ data }: { data: VisionnaireData }) {
  const plural = data.seers.length > 1;
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        🔮 {plural ? "Visionnaires" : "Visionnaire"} du Match
      </p>
      <p className="text-white/50 text-sm sm:text-xl mb-6 sm:mb-8 italic">{data.match_label}</p>
      <p className="text-canal-gray-muted text-base sm:text-xl mb-4 sm:mb-6">Score exact prédit par</p>
      <div className="space-y-2 sm:space-y-3">
        {data.seers.map((name) => (
          <p key={name} className="font-black text-white text-3xl sm:text-5xl lg:text-6xl">
            ⭐ {name}
          </p>
        ))}
      </div>
      <p className="text-canal-yellow/60 text-sm sm:text-lg mt-6 sm:mt-10 flex items-center justify-center gap-2 italic">
        <img src="/goat.png" alt="🐐" className="h-[1em] object-contain" /> s&apos;incline.
      </p>
    </div>
  );
}

// ─── Slide: Drama (momentum 24h) ──────────────────────────────────────────────

function SlideDrama({ data }: { data: DramaData }) {
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-6 sm:mb-10">
        🚀 Remontée du Moment
      </p>
      <p className="font-black text-4xl sm:text-6xl lg:text-8xl text-white mb-2 sm:mb-3">{data.name}</p>
      {data.team_name && (
        <p className="text-canal-gray-muted text-lg sm:text-2xl mb-6 sm:mb-8">{data.team_name}</p>
      )}
      <p className="text-canal-green font-black text-5xl sm:text-8xl lg:text-9xl">
        +{data.delta} pts
      </p>
      <p className="text-canal-gray-muted text-base sm:text-xl mt-3 sm:mt-5">en 24 heures</p>
      <p className="text-canal-yellow/60 text-sm sm:text-lg mt-6 sm:mt-10 flex items-center justify-center gap-2 italic">
        <img src="/goat.png" alt="🐐" className="h-[1em] object-contain" /> observe. Et approuve.
      </p>
    </div>
  );
}

// ─── Slide: Fantômes ──────────────────────────────────────────────────────────

function SlideFantomes({ players }: { players: string[] }) {
  // Tous les fantômes : grille multi-colonnes + texte réduit quand il y en a
  // beaucoup, pour que tout tienne à l'écran.
  const many = players.length > 8;
  const dense = players.length > 18;
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-16 py-6 sm:py-10 text-center overflow-hidden">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        👻 Fantômes de la Canal Cup
      </p>
      <p className="text-white/50 text-base sm:text-xl mb-4 sm:mb-8 italic">
        N&apos;ont pas rejoint l&apos;app depuis 7 jours · {players.length}
      </p>
      <div
        className={
          many
            ? `grid ${dense ? "grid-cols-3 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3"} gap-x-6 gap-y-1.5 sm:gap-y-2 overflow-y-auto`
            : "space-y-2 sm:space-y-4"
        }
      >
        {players.map((name) => (
          <p
            key={name}
            className={`font-black text-white/60 ${many ? (dense ? "text-base sm:text-xl" : "text-lg sm:text-3xl") : "text-2xl sm:text-4xl lg:text-5xl"}`}
          >
            👻 {name}
          </p>
        ))}
      </div>
      <p className="text-canal-yellow/60 text-sm sm:text-lg mt-4 sm:mt-8 flex items-center justify-center gap-2 italic shrink-0">
        <img src="/goat.png" alt="🐐" className="h-[1em] object-contain" /> a lancé un avis de recherche.
      </p>
    </div>
  );
}

// ─── Slide: Le Goat dit… (punchline du coach IA) ────────────────────────────

const GOAT_PHRASES: string[] = [
  ...Object.values(SALON_PREMATCH).flat(),
  "Le Goat ne juge pas. Le Goat observe. Et Le Goat se souvient.",
  "Un bon prono, c'est 50% d'instinct et 50% de chance. Le Goat n'a ni l'un ni l'autre, mais il assume.",
  "Le classement ment rarement. Les egos, beaucoup plus.",
  "Participer, c'est déjà des points. Le Goat l'a vérifié lui-même.",
  "Le babyfoot révèle les caractères. Et parfois, il les détruit.",
];

function SlideGoat() {
  const [phrase, setPhrase] = useState("");
  useEffect(() => {
    const pick = () => setPhrase(GOAT_PHRASES[Math.floor(Math.random() * GOAT_PHRASES.length)]);
    pick();
    const t = setInterval(pick, 6000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center gap-6 sm:gap-10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/goat.png"
        alt="Le Goat"
        width={180}
        height={180}
        style={{ imageRendering: "auto" }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        className="w-28 h-28 sm:w-40 sm:h-40 lg:w-44 lg:h-44 object-contain drop-shadow-2xl"
      />
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest">
        Le Goat dit…
      </p>
      <p className="font-black text-2xl sm:text-4xl lg:text-6xl text-white leading-tight max-w-5xl break-words italic">
        &ldquo;{phrase}&rdquo;
      </p>
    </div>
  );
}

// ─── Slide: Le fail du jour (matinale) ────────────────────────────────────────

function SlideFail({ brief }: { brief: MorningBrief }) {
  if (!brief.fail_of_day) return null;
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-red-400 font-black text-xl sm:text-2xl uppercase tracking-widest mb-6 sm:mb-12">
        😅 Le fail du jour
      </p>
      <span className="text-5xl sm:text-7xl lg:text-8xl mb-4 sm:mb-8">💥</span>
      <p className="font-black text-2xl sm:text-4xl lg:text-5xl text-white italic leading-tight max-w-5xl break-words">
        &ldquo;{brief.fail_of_day}&rdquo;
      </p>
    </div>
  );
}

// ─── Slide: Le bureau a parié (répartition V/N/D du prochain match) ───────────

function SlideOfficeBet({ stats }: { stats: PreMatchStats }) {
  const { match } = stats;
  return (
    <div className="flex flex-col h-full justify-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12">
      <div className="mb-4 sm:mb-8 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">
          🔮 Le bureau a parié
        </p>
        <p className="text-canal-gray-muted text-sm sm:text-lg mb-2">Pronostics pour le prochain match</p>
        <div className="h-1 w-40 bg-canal-yellow" />
      </div>

      {/* Affiche */}
      <div className="flex items-center justify-center gap-3 sm:gap-10 mb-5 sm:mb-10">
        <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <Flag flag={match.flag_a} name={match.team_a} className="h-9 sm:h-14 lg:h-16 w-auto rounded-sm" emojiClassName="text-4xl sm:text-6xl lg:text-7xl" />
          <p className="font-black text-base sm:text-3xl text-white text-center break-words leading-tight">{match.team_a}</p>
        </div>
        <span className="font-black text-2xl sm:text-5xl text-canal-gray-muted shrink-0">VS</span>
        <div className="flex flex-col items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <Flag flag={match.flag_b} name={match.team_b} className="h-9 sm:h-14 lg:h-16 w-auto rounded-sm" emojiClassName="text-4xl sm:text-6xl lg:text-7xl" />
          <p className="font-black text-base sm:text-3xl text-white text-center break-words leading-tight">{match.team_b}</p>
        </div>
      </div>

      {/* Barre V/N/D */}
      <div className="flex rounded-full overflow-hidden h-8 sm:h-12 mb-2 sm:mb-3">
        {stats.pct_a > 0 && (
          <div className="bg-canal-yellow/80 h-full flex items-center justify-center" style={{ width: `${stats.pct_a}%` }}>
            <span className="text-canal-black font-black text-sm sm:text-2xl">{stats.pct_a}%</span>
          </div>
        )}
        {stats.pct_draw > 0 && (
          <div className="bg-canal-gray-muted/60 h-full flex items-center justify-center" style={{ width: `${stats.pct_draw}%` }}>
            <span className="text-white font-black text-sm sm:text-2xl">{stats.pct_draw}%</span>
          </div>
        )}
        {stats.pct_b > 0 && (
          <div className="bg-blue-400/70 h-full flex items-center justify-center" style={{ width: `${stats.pct_b}%` }}>
            <span className="text-white font-black text-sm sm:text-2xl">{stats.pct_b}%</span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-sm sm:text-2xl text-canal-gray-muted font-bold mb-5 sm:mb-10">
        <span className="truncate max-w-[30%]">{match.team_a}</span>
        <span>Nul</span>
        <span className="truncate max-w-[30%] text-right">{match.team_b}</span>
      </div>

      {/* Score exact le plus parié */}
      {stats.top_score ? (
        <div className="bg-canal-gray-mid/40 border border-canal-gray-light/30 rounded-2xl p-4 sm:p-6 text-center">
          <p className="text-canal-gray-muted text-sm sm:text-xl uppercase tracking-wide mb-1 sm:mb-2">Score exact le plus parié</p>
          <p className="font-black text-3xl sm:text-5xl lg:text-6xl text-canal-yellow">{stats.top_score}</p>
          <p className="text-canal-gray-muted text-sm sm:text-xl mt-1">{stats.top_score_pct}% des équipes y croient</p>
        </div>
      ) : (
        <p className="text-center text-canal-gray-muted text-base sm:text-2xl italic">
          Pas encore de score exact qui se dégage.
        </p>
      )}
    </div>
  );
}

// ─── Slide: Ça se joue à rien (duel le plus serré) ────────────────────────────

interface TightRace {
  label: string;
  first: string;
  second: string;
  gap: number;
  unit: string;
}

// « Ça se joue à rien » : on n'affiche QUE la bataille des services quand les
// deux premiers se tiennent en ≤ 1 point (moyenne/pers). Sinon → null → la
// slide n'est pas affichée du tout.
function computeTightRace(data: TVData): TightRace | null {
  const svc = [...(data.services ?? [])].sort((a, b) => b.average - a.average);
  if (svc.length < 2 || svc[0].average <= 0) return null;
  const gap = Math.round((svc[0].average - svc[1].average) * 10) / 10;
  if (gap > 1) return null;
  return {
    label: "Bataille des Services",
    first: svc[0].service.name,
    second: svc[1].service.name,
    gap,
    unit: "pts/pers",
  };
}

function SlideTightRace({ race }: { race: TightRace }) {
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        🔥 Ça se joue à rien
      </p>
      <p className="text-canal-gray-muted text-base sm:text-2xl mb-6 sm:mb-12">{race.label}</p>

      <div className="flex items-center justify-center gap-3 sm:gap-12 w-full mb-6 sm:mb-12">
        <div className="flex-1 min-w-0">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase mb-1 sm:mb-2">🥇 En tête</p>
          <p className="font-black text-xl sm:text-4xl lg:text-5xl text-white break-words leading-tight">{race.first}</p>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="text-canal-gray-muted text-xs sm:text-lg">Écart</span>
          <span className="font-black text-4xl sm:text-7xl lg:text-8xl text-red-400 leading-none">
            {race.gap > 0 ? `+${race.gap}` : race.gap}
          </span>
          <span className="text-canal-gray-muted text-xs sm:text-lg">{race.unit}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-canal-gray-muted text-xs sm:text-xl uppercase mb-1 sm:mb-2">🥈 Poursuit</p>
          <p className="font-black text-xl sm:text-4xl lg:text-5xl text-white break-words leading-tight">{race.second}</p>
        </div>
      </div>

      <p className="text-canal-gray-muted text-base sm:text-2xl italic">
        Le duel le plus serré de toute la Canal Cup.
      </p>
    </div>
  );
}

// ─── Slide: Clash (plus gros écart du jour) ───────────────────────────────────

interface ScoreGap {
  winner: string;
  loser: string;
  winnerFlag?: string;
  loserFlag?: string;
  winnerScore: number;
  loserScore: number;
  gap: number;
  stage?: string;
  jab: string;
}

function computeScoreGap(matches: Match[]): ScoreGap | null {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end = new Date(); end.setHours(23, 59, 59, 999);
  const best = matches
    .filter((m) => {
      if (m.status !== "finished") return false;
      if (m.score_a == null || m.score_b == null) return false;
      const t = new Date(m.starts_at).getTime();
      return t >= start.getTime() && t <= end.getTime();
    })
    .map((m) => ({
      m,
      gap: Math.abs((m.score_a ?? 0) - (m.score_b ?? 0)),
      goals: (m.score_a ?? 0) + (m.score_b ?? 0),
    }))
    // On ne chambre que les vraies corrections (≥ 2 buts d'écart).
    .filter((x) => x.gap >= 2)
    .sort((a, b) => b.gap - a.gap || b.goals - a.goals)[0];
  if (!best) return null;
  const { m, gap } = best;
  const aWon = (m.score_a ?? 0) > (m.score_b ?? 0);
  const jabs = [
    "On range les crampons, on rentre à la maison.",
    "Score de tennis. Bravo l'organisation.",
    "Quelqu'un a pensé à prévenir la défense ?",
    "Une correction en bonne et due forme.",
    "Ça, ça va laisser des traces au classement.",
  ];
  return {
    winner: aWon ? m.team_a : m.team_b,
    loser: aWon ? m.team_b : m.team_a,
    winnerFlag: aWon ? m.flag_a : m.flag_b,
    loserFlag: aWon ? m.flag_b : m.flag_a,
    winnerScore: aWon ? (m.score_a ?? 0) : (m.score_b ?? 0),
    loserScore: aWon ? (m.score_b ?? 0) : (m.score_a ?? 0),
    gap,
    stage: m.stage,
    jab: jabs[gap % jabs.length],
  };
}

function SlideScoreGap({ gap }: { gap: ScoreGap }) {
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        💥 Le Clash du Jour
      </p>
      <p className="text-canal-gray-muted text-base sm:text-2xl mb-6 sm:mb-10">
        Plus gros écart du jour{gap.stage ? ` · ${gap.stage}` : ""}
      </p>

      <div className="flex items-center justify-center gap-3 sm:gap-10 w-full mb-6 sm:mb-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
            <Flag flag={gap.winnerFlag} name={gap.winner} className="h-4 sm:h-7 w-auto rounded-sm shrink-0" emojiClassName="text-lg sm:text-3xl shrink-0" />
            <span className="text-canal-gray-muted text-xs sm:text-xl uppercase">🏆 Vainqueur</span>
          </div>
          <p className="font-black text-xl sm:text-4xl lg:text-5xl text-canal-yellow break-words leading-tight">{gap.winner}</p>
        </div>
        <div className="flex flex-col items-center shrink-0">
          <span className="font-black text-4xl sm:text-7xl lg:text-8xl text-white leading-none tabular-nums">
            {gap.winnerScore}–{gap.loserScore}
          </span>
          <span className="text-red-400 font-black text-base sm:text-2xl mt-1">+{gap.gap}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
            <Flag flag={gap.loserFlag} name={gap.loser} className="h-4 sm:h-7 w-auto rounded-sm shrink-0 opacity-60" emojiClassName="text-lg sm:text-3xl shrink-0 opacity-60" />
            <span className="text-canal-gray-muted text-xs sm:text-xl uppercase">😴 Battu</span>
          </div>
          <p className="font-black text-xl sm:text-4xl lg:text-5xl text-white/50 break-words leading-tight">{gap.loser}</p>
        </div>
      </div>

      <p className="text-white/80 text-base sm:text-2xl italic">{gap.jab}</p>
      <p className="text-canal-yellow/60 text-sm sm:text-lg mt-6 sm:mt-10 flex items-center justify-center gap-2 italic">
        <img src="/goat.png" alt="🐐" className="h-[1em] object-contain" /> a tout vu. Et a déjà choisi son camp.
      </p>
    </div>
  );
}

// ─── Slide: Aujourd'hui (compteurs du jour) ───────────────────────────────────

function SlideStats({ stats }: { stats: { pronos: number; quiz: number; animations: number } }) {
  const items = [
    { emoji: "🎯", value: stats.pronos, label: "pronos" },
    { emoji: "🧠", value: stats.quiz, label: "quiz" },
    { emoji: "🎉", value: stats.animations, label: "défis" },
  ];
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-8 sm:mb-16">
        📈 Aujourd&apos;hui
      </p>
      <div className="grid grid-cols-3 gap-4 sm:gap-12 w-full max-w-5xl">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col items-center gap-1 sm:gap-3">
            <span className="text-4xl sm:text-7xl">{it.emoji}</span>
            <span className="font-black text-4xl sm:text-7xl lg:text-8xl text-canal-yellow leading-none">{it.value}</span>
            <span className="text-canal-gray-muted text-base sm:text-3xl uppercase tracking-wide">{it.label}</span>
          </div>
        ))}
      </div>
      <p className="text-canal-gray-muted text-base sm:text-2xl italic mt-8 sm:mt-16">
        Le bureau a été productif. Enfin, sur la Canal Cup.
      </p>
    </div>
  );
}

// ─── Slide: Bienvenue (nouveaux joueurs) ──────────────────────────────────────

function SlideWelcome({ players }: { players: string[] }) {
  const list = players.slice(0, 12);
  if (!list.length) return null;
  const dense = list.length > 6;
  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-20 py-6 sm:py-12 text-center">
      <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-2 sm:mb-4">
        🙌 Bienvenue
      </p>
      <p className="text-canal-gray-muted text-base sm:text-2xl mb-6 sm:mb-10">Ils viennent de rejoindre la Canal Cup</p>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-5 max-w-5xl overflow-y-auto">
        {list.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className={`font-black text-white bg-canal-gray-mid/50 border border-canal-yellow/30 rounded-2xl px-4 sm:px-7 py-2 sm:py-4 ${
              dense ? "text-lg sm:text-3xl" : "text-2xl sm:text-4xl lg:text-5xl"
            }`}
          >
            👋 {name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Slide: Course au meilleur buteur (bureau) ────────────────────────────────

function SlideTopScorerRace({ bets }: { bets: { name: string; count: number }[] }) {
  if (!bets.length) return null;
  return (
    <RankedList
      title="🥅 Course au meilleur buteur"
      subtitle="Qui le bureau voit finir buteur n°1"
      items={bets.map((b, i) => ({
        id: `${b.name}-${i}`,
        name: b.name,
        value: b.count,
        valueUnit: b.count > 1 ? "mises" : "mise",
      }))}
    />
  );
}

// ─── Slide: Le mur des pronos (heatmap géante) ────────────────────────────────

const HEAT_CELL_STYLE: Record<PredictionOutcome, string> = {
  exact: "bg-canal-yellow",
  correct_result: "bg-green-500",
  correct_diff: "bg-amber-500",
  wrong: "bg-red-500/80",
  pending: "bg-canal-gray-light/40",
};

function SlideHeatmapWall({ rows }: { rows: TvHeatmapRow[] }) {
  if (!rows.length) return null;
  const dense = rows.length > 4;
  const cellSize = dense ? "w-6 h-6 sm:w-9 sm:h-9" : "w-8 h-8 sm:w-12 sm:h-12";
  const legend: { o: PredictionOutcome; label: string }[] = [
    { o: "exact", label: "Score exact" },
    { o: "correct_result", label: "Bon résultat" },
    { o: "wrong", label: "Raté" },
    { o: "pending", label: "À venir" },
  ];
  return (
    <div className="flex flex-col h-full px-4 sm:px-8 lg:px-16 py-6 sm:py-10">
      <div className="mb-3 sm:mb-5 shrink-0">
        <p className="text-canal-yellow font-black text-xl sm:text-2xl uppercase tracking-widest mb-1">
          📊 Le mur des pronos
        </p>
        <p className="text-canal-gray-muted text-sm sm:text-lg mb-2">Les meilleurs joueurs &amp; leurs derniers pronos</p>
        <div className="h-1 w-40 bg-canal-yellow" />
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col justify-center gap-2 sm:gap-4">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3 sm:gap-6">
            <span className="w-28 sm:w-56 shrink-0 font-black text-white text-base sm:text-2xl lg:text-3xl truncate">
              {row.name}
            </span>
            <div className="flex gap-1.5 sm:gap-2.5 flex-wrap">
              {row.cells.map((c, i) => (
                <span key={i} className={`${cellSize} rounded-md ${HEAT_CELL_STYLE[c]} shrink-0`} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-8 gap-y-1 mt-3 sm:mt-6 shrink-0">
        {legend.map((l) => (
          <span key={l.o} className="flex items-center gap-2 text-canal-gray-muted text-sm sm:text-xl">
            <span className={`inline-block w-4 h-4 sm:w-6 sm:h-6 rounded ${HEAT_CELL_STYLE[l.o]}`} /> {l.label}
          </span>
        ))}
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
      <p className="text-canal-gray-muted text-lg italic opacity-70">{withGoat(phrase)}</p>
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

// ─── Slide : CTA activation notifications push ────────────────────────────────

const NOTIF_LINES = [
  {
    main: "Votre téléphone est silencieux.",
    sub: "Canal Cup vous a envoyé 3 notifs ce matin. Dans le vide. Dramatique.",
  },
  {
    main: "Vous apprenez les résultats par la rumeur ?",
    sub: "Il y a une option \"notifier\" dans votre profil. Elle vous attend depuis le début.",
  },
  {
    main: "Le Goat a essayé de vous contacter.",
    sub: "Boîte vocale pleine. Notifications désactivées. Signal de fumée en cours d'étude.",
  },
  {
    main: "Cloche grise = âme en peine.",
    sub: "Un simple clic dans votre profil et la cloche devient jaune. C'est la vie qui reprend.",
  },
  {
    main: "Votre concurrent vient de pronostiquer.",
    sub: "Il a reçu une notif. Vous, vous regardez cet écran. Coïncidence ?",
  },
];

function SlideNotifCTA() {
  // Une seule phrase aléatoire par affichage — pas de rotation pour éviter
  // l'impression que la slide passe "plusieurs fois de suite".
  const line = useMemo(
    () => NOTIF_LINES[Math.floor(Math.random() * NOTIF_LINES.length)],
    []
  );

  return (
    <div className="flex flex-col h-full justify-center items-center px-4 sm:px-8 lg:px-24 py-6 sm:py-10 text-center gap-4 sm:gap-8">

      {/* Icône cloche animée */}
      <div className="relative">
        <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full bg-canal-gray-mid/60 border-2 border-canal-gray-light flex items-center justify-center">
          <span className="text-4xl sm:text-6xl grayscale">🔕</span>
        </div>
        <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 w-6 h-6 sm:w-9 sm:h-9 bg-red-500 rounded-full flex items-center justify-center text-white font-black text-xs sm:text-base animate-pulse">
          !
        </span>
      </div>

      {/* Titre */}
      <div>
        <p className="text-canal-yellow font-black text-xs sm:text-sm uppercase tracking-widest mb-2 sm:mb-3">
          📵 Notifications désactivées
        </p>
        <p className="font-black text-2xl sm:text-4xl lg:text-5xl text-white leading-tight max-w-4xl">
          {line.main}
        </p>
      </div>

      {/* Punchline */}
      <p className="text-canal-gray-muted text-base sm:text-2xl lg:text-3xl italic max-w-3xl leading-snug">
        {line.sub}
      </p>

      {/* CTA */}
      <div className="flex flex-col items-center gap-2 sm:gap-3 mt-2 sm:mt-4">
        <p className="text-white/40 text-xs sm:text-base uppercase tracking-widest font-bold">La solution en 2 secondes</p>
        <div className="flex items-center gap-3 sm:gap-5 bg-canal-gray-mid/50 border border-canal-yellow/30 rounded-2xl px-5 sm:px-8 py-3 sm:py-4">
          <span className="text-2xl sm:text-4xl">📱</span>
          <div className="text-left">
            <p className="text-white font-black text-sm sm:text-xl">Ouvrir votre profil</p>
            <p className="text-canal-yellow text-xs sm:text-base">Appuyer sur la cloche 🔔 — c&apos;est tout.</p>
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TVPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [data, setData] = useState<TVData | null>(null);
  const [origin, setOrigin] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cursorVisible, setCursorVisible] = useState(true);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = () => setIsFullscreen(
      !!(document.fullscreenElement || (document as unknown as Record<string,unknown>).webkitFullscreenElement)
    );
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);

  // Cache le curseur après 3 s d'inactivité — toujours actif sur la page TV,
  // indépendamment du fullscreen (Samsung TV ne déclenche pas toujours fullscreenchange).
  useEffect(() => {
    const showCursor = () => {
      setCursorVisible(true);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = setTimeout(() => setCursorVisible(false), 3000);
    };
    cursorTimerRef.current = setTimeout(() => setCursorVisible(false), 3000);
    document.addEventListener("mousemove", showCursor);
    document.addEventListener("pointermove", showCursor);
    return () => {
      document.removeEventListener("mousemove", showCursor);
      document.removeEventListener("pointermove", showCursor);
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const fetchData = () => {
    fetch("/api/tv")
      .then((r) => r.json())
      .then((d: TVData) => setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    setOrigin(
      process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "")
    );
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, []);

  // Skip les slides dont les données sont absentes/vides → pas de slide vide en
  // boucle sur le salon (animations, individual, services, médailles, news,
  // standings).
  const hasChallenges = !!data?.challenges?.length;
  const hasIndividual = !!data?.individual?.length;
  const hasServices = !!data?.services?.length;
  const hasMedals = !!data?.medals?.length;
  const hasNews = !!data?.news?.length;
  const hasStandings = !!data?.standings?.length;
  const hasPrematch = !!data?.prematch;
  const hasFail = !!data?.brief?.fail_of_day;
  const hasMatinale = !!data?.brief;
  const hasHallOfShame = !!data?.hallofshame?.shame?.length;
  const hasVisionnaire = !!data?.visionnaire?.seers?.length;
  const hasDrama = !!data?.drama;
  const hasFantomes = !!data?.fantomes?.length;
  const tightRace = data ? computeTightRace(data) : null;
  const hasTightRace = !!tightRace;
  const scoreGap = data ? computeScoreGap(data.matches) : null;
  const hasScoreGap = !!scoreGap;
  const ts = data?.todayStats;
  const hasTodayStats = !!ts && (ts.pronos > 0 || ts.quiz > 0 || ts.animations > 0);
  const hasNewPlayers = !!data?.newPlayers?.length;
  const hasTopScorerBets = !!data?.topScorerBets?.length;
  const hasAnyMatch = !!data?.matches?.some((m) => ["live", "halftime", "upcoming", "finished"].includes(m.status));
  const hasLiveMatch = !!data?.matches?.some((m) => m.status === "live" || m.status === "halftime");
  const hasTodayUpcoming = (() => {
    if (!data?.matches) return false;
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return data.matches.some((m) => {
      const t = new Date(m.starts_at).getTime();
      return t >= s.getTime() && t <= e.getTime() && m.status === "upcoming";
    });
  })();
  const hasTodayMatches = (() => {
    if (!data?.matches) return false;
    const s = new Date(); s.setHours(0, 0, 0, 0);
    const e = new Date(); e.setHours(23, 59, 59, 999);
    return data.matches.some((m) => {
      const t = new Date(m.starts_at).getTime();
      return t >= s.getTime() && t <= e.getTime();
    });
  })();
  // Phase éliminatoire COMMENCÉE = un match hors poule déjà live/terminé.
  // (un simple match "Finale" planifié — ex. match test — ne doit PAS l'activer)
  const hasEliminationPhase = !!data?.matches?.some(
    (m) =>
      m.phase &&
      !["Groupe", "groupe", "Group Stage", "group"].includes(m.phase) &&
      ["live", "halftime", "finished"].includes(m.status)
  );
  // Quiz : seulement si des points quiz ont été attribués
  const hasQuizData = !!data?.individual?.some((r) => r.quiz > 0);

  const filtered = BASE_SLIDES.filter((s) => {
    if (s === "match") return hasAnyMatch;
    if (s === "livematch") return hasLiveMatch;
    if (s === "animations") return hasChallenges;
    if (s === "general" || s === "playerofday") return hasIndividual;
    if (s === "quiz") return hasIndividual && hasQuizData;
    if (s === "services") return hasServices;
    if (s === "medals") return hasMedals && hasEliminationPhase;
    if (s === "bracket") return hasEliminationPhase;
    if (s === "news") return hasNews;
    if (s === "standings") return hasStandings;
    if (s === "officebet") return hasPrematch;
    if (s === "fail") return hasFail;
    if (s === "tightrace") return hasTightRace;
    if (s === "welcome") return hasNewPlayers;
    if (s === "topscorerrace") return hasTopScorerBets;
    if (s === "revivez") return !!data?.revivezPosts?.length;
    if (s === "matinale") return hasMatinale;
    if (s === "hallofshame") return hasHallOfShame;
    if (s === "visionnaire") return hasVisionnaire;
    if (s === "drama") return hasDrama;
    if (s === "fantomes") return hasFantomes;
    if (s === "squads") return hasTodayUpcoming;
    if (s === "results") return hasTodayMatches;
    if (s === "scoregap") return hasScoreGap;
    return true;
  });

  // notifcta = slide normale (placée par le shuffle), sauf pendant un match live.
  if (!!data && !hasLiveMatch) filtered.push("notifcta");

  // Mélange anti-répétition (aucune slide de même thème à la suite).
  const slides = useMemo(() => arrangeSlides(filtered), [filtered.join("|")]);

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
    <div className={`fixed inset-0 bg-canal-black flex flex-col overflow-hidden tv-mode${!cursorVisible ? " cursor-none" : ""}`}>
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
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
            className="flex flex-col items-center gap-1 px-2 py-1 rounded-lg hover:bg-canal-gray-mid/60 active:scale-95 transition-all cursor-pointer"
          >
            {isFullscreen
              ? <Minimize2 size={22} className="text-canal-yellow" />
              : <Maximize2 size={22} className="text-canal-gray-muted hover:text-white transition-colors" />}
            <span className="text-[10px] text-canal-gray-muted">{isFullscreen ? "Réduire" : "Plein écran"}</span>
          </button>
          <div className="w-px h-8 sm:h-10 bg-canal-gray-light" />
          <div className="flex flex-col items-center gap-1">
            {origin ? (
              <img
                key={`${origin}/p/welcome`}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=${encodeURIComponent(`${origin}/p/welcome`)}`}
                alt="QR code Canal Cup"
                width={56}
                height={56}
                className="rounded-md bg-white p-1 w-10 h-10 sm:w-14 sm:h-14 animate-fade-in"
              />
            ) : (
              <QrCode size={40} className="text-canal-gray-muted" />
            )}
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
                      &ldquo;Aucun match à l&apos;horizon.{" "}
                      <img src="/goat.png" alt="🐐" className="inline h-[1em] object-contain align-middle mx-0.5" />
                      {" "}se repose. Temporairement.&rdquo;
                    </p>
                  </div>
                )
            )}
            {slide === "squads" && <SlideTodaySquads matches={data.matches} />}
            {slide === "upcoming" && (
              <SlideUpcoming events={data.events ?? []} matches={data.matches} />
            )}
            {slide === "match" && <SlideMatch matches={data.matches} />}
            {slide === "results" && <SlideResults matches={data.matches} matchEvents={data.matchEvents ?? []} />}
            {slide === "scoregap" && scoreGap && <SlideScoreGap gap={scoreGap} />}
            {slide === "livematch" && <SlideLiveMatch matches={data.matches} />}
            {slide === "standings" && <SlideStandings standings={data.standings ?? []} />}
            {slide === "bracket" && <SlideBracket />}
            {slide === "matinale" && data.brief && <SlideMatinale brief={data.brief} />}
            {slide === "revivez" && <SlideRevivez posts={data.revivezPosts} />}
            {slide === "animations" && <SlideAnimations challenges={data.challenges ?? []} />}
            {slide === "general" && <SlideGeneral individual={data.individual ?? []} />}
            {slide === "quiz" && <SlideQuiz individual={data.individual ?? []} />}
            {slide === "services" && <SlideServices services={data.services ?? []} />}
            {slide === "medals" && <SlideMedals medals={data.medals ?? []} />}
            {slide === "playerofday" && <SlidePlayerOfDay individual={data.individual ?? []} />}
            {slide === "news" && <SlideNews news={data.news ?? []} />}
            {slide === "robert" && <SlideGoat />}
            {slide === "fail" && data.brief && <SlideFail brief={data.brief} />}
            {slide === "officebet" && data.prematch && <SlideOfficeBet stats={data.prematch} />}
            {slide === "tightrace" && tightRace && <SlideTightRace race={tightRace} />}
            {slide === "hallofshame" && data.hallofshame && <SlideHallOfShame data={data.hallofshame} />}
            {slide === "visionnaire" && data.visionnaire && <SlideVisionnaire data={data.visionnaire} />}
            {slide === "drama" && data.drama && <SlideDrama data={data.drama} />}
            {slide === "fantomes" && data.fantomes && <SlideFantomes players={data.fantomes} />}
            {slide === "welcome" && <SlideWelcome players={data.newPlayers ?? []} />}
            {slide === "topscorerrace" && <SlideTopScorerRace bets={data.topScorerBets ?? []} />}
            {slide === "notifcta" && <SlideNotifCTA />}
          </>
        )}
      </div>

      {/* QR widget permanent — coin bas-droit */}
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
