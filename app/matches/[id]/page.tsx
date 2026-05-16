"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { MatchDetail } from "@/lib/football";
import type { Match } from "@/lib/supabase/types";
import { Tv, Clock, MapPin, User, RefreshCw } from "lucide-react";

type Tab = "timeline" | "lineups" | "stats";

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽",
  yellow_card: "🟨",
  red_card: "🟥",
  substitution: "🔄",
  var: "📺",
  penalty_missed: "❌",
};

function StatusBadge({ status, minute }: { status: string; minute: number | null }) {
  if (status === "live") {
    return (
      <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded-full animate-pulse">
        <span className="w-1.5 h-1.5 bg-white rounded-full" />
        {minute ? `${minute}'` : "LIVE"}
      </span>
    );
  }
  if (status === "halftime") {
    return <span className="bg-orange-600 text-white text-xs font-black px-2 py-0.5 rounded-full">MI-TEMPS</span>;
  }
  if (status === "finished") {
    return <span className="bg-canal-gray-mid text-canal-gray-muted text-xs font-bold px-2 py-0.5 rounded-full">TERMINÉ</span>;
  }
  return <span className="bg-canal-gray-mid text-canal-gray-muted text-xs font-bold px-2 py-0.5 rounded-full">À VENIR</span>;
}

function ScoreBoard({ match, detail }: { match: Match; detail: MatchDetail | null }) {
  const live = detail?.match;
  const scoreA = live?.score_home ?? match.score_a ?? null;
  const scoreB = live?.score_away ?? match.score_b ?? null;

  const kickoff = new Date(match.starts_at);
  const timeStr = kickoff.toLocaleTimeString("fr-NC", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" });
  const dateStr = kickoff.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="bg-gradient-to-b from-canal-gray to-canal-black px-4 pt-6 pb-4">
      <p className="text-center text-xs text-canal-gray-muted mb-1">{match.competition}</p>
      {live && <div className="flex justify-center mb-3"><StatusBadge status={live.status} minute={live.minute} /></div>}

      <div className="flex items-center justify-between gap-4 my-4">
        {/* Team A */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-5xl">{match.flag_a}</span>
          <span className="text-sm font-black text-white text-center leading-tight">{match.team_a}</span>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          {scoreA !== null && scoreB !== null ? (
            <>
              <span className="text-5xl font-black text-white tabular-nums">{scoreA}</span>
              <span className="text-3xl text-canal-gray-muted font-bold">–</span>
              <span className="text-5xl font-black text-white tabular-nums">{scoreB}</span>
            </>
          ) : (
            <div className="text-center">
              <p className="text-canal-yellow font-black text-xl">{timeStr}</p>
              <p className="text-canal-gray-muted text-xs mt-0.5">{dateStr}</p>
            </div>
          )}
        </div>

        {/* Team B */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <span className="text-5xl">{match.flag_b}</span>
          <span className="text-sm font-black text-white text-center leading-tight">{match.team_b}</span>
        </div>
      </div>

      {/* Meta */}
      <div className="flex items-center justify-center gap-4 text-xs text-canal-gray-muted flex-wrap">
        <span className="flex items-center gap-1"><Tv size={11} /> {match.channel}</span>
        {live?.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {live.venue}</span>}
        {live?.referee && <span className="flex items-center gap-1"><User size={11} /> {live.referee}</span>}
      </div>
    </div>
  );
}

function Timeline({ events }: { events: MatchDetail["events"] }) {
  if (!events.length) {
    return <p className="text-center text-canal-gray-muted text-sm py-8">Aucun événement pour l'instant.</p>;
  }

  return (
    <div className="space-y-1 py-2">
      {[...events].reverse().map((e, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-3 px-4 py-2.5 rounded-xl",
            e.type === "goal" && "bg-canal-yellow/10 border border-canal-yellow/20",
            e.type === "red_card" && "bg-red-950/30 border border-red-900/20",
          )}
        >
          {e.team === "home" ? (
            <>
              <span className="text-base w-6">{EVENT_ICONS[e.type] ?? "•"}</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">{e.player_name}</p>
                {e.detail && <p className="text-xs text-canal-gray-muted">{e.detail}</p>}
              </div>
              <span className="text-canal-yellow font-black text-sm">{e.minute}'</span>
            </>
          ) : (
            <>
              <span className="text-canal-yellow font-black text-sm">{e.minute}'</span>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold text-white">{e.player_name}</p>
                {e.detail && <p className="text-xs text-canal-gray-muted">{e.detail}</p>}
              </div>
              <span className="text-base w-6 text-right">{EVENT_ICONS[e.type] ?? "•"}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function Lineups({ lineups }: { lineups: NonNullable<MatchDetail["lineups"]> }) {
  const starters = (side: "home" | "away") =>
    lineups[side].players.filter((p) => p.is_starting);
  const bench = (side: "home" | "away") =>
    lineups[side].players.filter((p) => !p.is_starting);

  return (
    <div className="py-2 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {(["home", "away"] as const).map((side) => (
          <div key={side}>
            <p className="text-xs text-canal-gray-muted font-bold uppercase tracking-wider mb-2 px-1">
              {lineups[side].formation} · {lineups[side].coach}
            </p>
            <div className="space-y-1">
              {starters(side).map((p, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canal-gray-mid">
                  <span className="text-xs text-canal-gray-muted w-5 text-center font-bold">{p.shirt_number}</span>
                  <span className="text-xs text-white font-bold truncate flex-1">{p.player_name}</span>
                  <span className="text-xs text-canal-gray-muted">{p.position}</span>
                </div>
              ))}
            </div>
            {bench(side).length > 0 && (
              <>
                <p className="text-xs text-canal-gray-muted mt-2 mb-1 px-1">Banc</p>
                <div className="space-y-1">
                  {bench(side).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded-lg opacity-60">
                      <span className="text-xs text-canal-gray-muted w-5 text-center">{p.shirt_number}</span>
                      <span className="text-xs text-canal-gray-muted truncate flex-1">{p.player_name}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats({ stats, match }: { stats: MatchDetail["stats"]; match: Match }) {
  if (!stats.length) {
    return <p className="text-center text-canal-gray-muted text-sm py-8">Stats disponibles après le coup d'envoi.</p>;
  }

  return (
    <div className="py-2 space-y-3">
      {stats.map((s, i) => {
        const homeVal = parseFloat(s.home_value) || 0;
        const awayVal = parseFloat(s.away_value) || 0;
        const total = homeVal + awayVal || 1;
        const homePct = Math.round((homeVal / total) * 100);

        return (
          <div key={i}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-black text-white">{s.home_value}</span>
              <span className="text-xs text-canal-gray-muted">{s.stat_type}</span>
              <span className="text-sm font-black text-white">{s.away_value}</span>
            </div>
            <div className="h-1.5 bg-canal-gray-mid rounded-full overflow-hidden flex">
              <div
                className="bg-canal-yellow rounded-l-full transition-all"
                style={{ width: `${homePct}%` }}
              />
              <div className="flex-1 bg-canal-gray-light rounded-r-full" />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-xs text-canal-gray-muted">{match.team_a}</span>
              <span className="text-xs text-canal-gray-muted">{match.team_b}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MatchCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ match: Match; detail: MatchDetail | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetch_ = useCallback(async () => {
    const res = await fetch(`/api/matches/${id}`);
    if (res.ok) {
      const json = await res.json();
      setData(json);
      setLastUpdate(new Date());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetch_();
    // Refresh every 60s if match is live
    const interval = setInterval(() => {
      if (data?.detail?.match.status === "live" || data?.detail?.match.status === "halftime") {
        fetch_();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [fetch_, data?.detail?.match.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-canal-black flex items-center justify-center">
        <p className="text-canal-gray-muted">Match introuvable.</p>
      </div>
    );
  }

  const { match, detail } = data;
  const isLive = detail?.match.status === "live" || detail?.match.status === "halftime";

  const tabs: { key: Tab; label: string }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "lineups", label: "Compos" },
    { key: "stats", label: "Stats" },
  ];

  return (
    <div className="min-h-screen bg-canal-black">
      <ScoreBoard match={match} detail={detail} />

      {/* Refresh indicator for live */}
      {isLive && lastUpdate && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-red-950/20 border-b border-red-900/20">
          <RefreshCw size={10} className="text-red-400" />
          <span className="text-xs text-red-400">
            Mis à jour à {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · auto toutes les 60s
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-canal-gray-light sticky top-0 bg-canal-black z-10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-colors",
              tab === t.key
                ? "text-canal-yellow border-b-2 border-canal-yellow"
                : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 pb-8 max-w-2xl mx-auto">
        {tab === "timeline" && (
          <Timeline events={detail?.events ?? []} />
        )}
        {tab === "lineups" && detail?.lineups && (
          <Lineups lineups={detail.lineups} />
        )}
        {tab === "lineups" && !detail?.lineups && (
          <p className="text-center text-canal-gray-muted text-sm py-8">
            Compositions disponibles avant le coup d'envoi.
          </p>
        )}
        {tab === "stats" && (
          <Stats stats={detail?.stats ?? []} match={match} />
        )}
      </div>

      {/* Clock */}
      {!isLive && match.status === "upcoming" && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-canal-black/90 border border-canal-gray-light rounded-full px-4 py-2 shadow-xl">
            <Clock size={14} className="text-canal-yellow" />
            <span className="text-sm text-white font-bold">
              {new Date(match.starts_at).toLocaleString("fr-FR", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit",
                timeZone: "Pacific/Noumea",
              })} NC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
