"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import type { FullMatchDetail, MatchEvent, LineupPlayer, PlayerMatchStat, StandingRow } from "@/services/football/types";
import { MapPin, User, RefreshCw, Clock, Sparkles, Star } from "lucide-react";
import { MatchReactions } from "@/components/matches/MatchReactions";
import { Countdown } from "@/components/matches/Countdown";
import { TeamLink } from "@/components/teams/TeamLink";

type Tab = "timeline" | "lineups" | "stats" | "notes" | "pronos" | "standings";

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽", yellow_card: "🟨", red_card: "🟥",
  substitution: "🔄", var: "📺", penalty: "🎯", penalty_missed: "❌",
};
const EVENT_COLORS: Record<string, string> = {
  goal: "bg-canal-yellow/10 border border-canal-yellow/20",
  red_card: "bg-red-950/30 border border-red-900/20",
  yellow_card: "bg-yellow-950/20 border border-yellow-900/20",
};

function StatusBadge({ status, minute }: { status: string; minute: number | null }) {
  if (status === "live") return (
    <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-black px-2.5 py-1 rounded-full animate-pulse">
      <span className="w-1.5 h-1.5 bg-white rounded-full" />
      {minute ? `${minute}'` : "LIVE"}
    </span>
  );
  if (status === "halftime") return <span className="bg-orange-600 text-white text-xs font-black px-2.5 py-1 rounded-full">MI-TEMPS</span>;
  if (status === "finished") return <span className="bg-canal-gray-mid text-canal-gray-muted text-xs font-bold px-2.5 py-1 rounded-full">TERMINÉ</span>;
  return <span className="bg-canal-gray-mid text-canal-gray-muted text-xs font-bold px-2.5 py-1 rounded-full">À VENIR</span>;
}

function ScoreBoard({ detail }: { detail: FullMatchDetail }) {
  const { match } = detail;
  const kickoff = new Date(match.starts_at);
  const timeStr = kickoff.toLocaleTimeString("fr-NC", { hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea" });
  const dateStr = kickoff.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const hasScore = match.score_a !== null && match.score_b !== null;

  return (
    <div className="bg-gradient-to-b from-canal-gray to-canal-black px-4 pt-6 pb-4">
      <p className="text-center text-xs text-canal-gray-muted mb-1 uppercase tracking-wider">{match.competition}</p>
      {match.phase && <p className="text-center text-xs text-canal-gray-muted mb-2">{match.phase}</p>}
      <div className="flex justify-center mb-3">
        <StatusBadge status={match.status} minute={match.minute} />
      </div>

      <div className="flex items-center justify-between gap-4 my-4">
        <div className="flex-1 flex flex-col items-center">
          <TeamLink
            name={match.team_a}
            flag={match.flag_a}
            stacked
            flagClassName="text-6xl"
            className="text-sm font-black text-white text-center leading-tight max-w-full"
            wrapperClassName="gap-2 max-w-full"
          />
        </div>

        <div className="flex items-center gap-3">
          {hasScore ? (
            <>
              <span className="text-6xl font-black text-white tabular-nums">{match.score_a}</span>
              <span className="text-4xl text-canal-gray-muted font-bold">–</span>
              <span className="text-6xl font-black text-white tabular-nums">{match.score_b}</span>
            </>
          ) : (
            <div className="text-center">
              <p className="text-canal-yellow font-black text-2xl">{timeStr}</p>
              <p className="text-canal-gray-muted text-xs mt-0.5">{dateStr}</p>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center">
          <TeamLink
            name={match.team_b}
            flag={match.flag_b}
            stacked
            flagClassName="text-6xl"
            className="text-sm font-black text-white text-center leading-tight max-w-full"
            wrapperClassName="gap-2 max-w-full"
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-canal-gray-muted flex-wrap">
        {match.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {match.venue}</span>}
        {match.referee && <span className="flex items-center gap-1"><User size={11} /> {match.referee}</span>}
      </div>
    </div>
  );
}

function EventRow({ event, teamA, teamB }: { event: MatchEvent; teamA: string; teamB: string }) {
  const isHome = event.team_side === "home";
  const icon = EVENT_ICONS[event.type] ?? "•";
  const colorClass = EVENT_COLORS[event.type] ?? "";

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl", colorClass)}>
      {isHome ? (
        <>
          <span className="text-lg w-7">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{event.player_name}</p>
            {event.assist_player_name && <p className="text-xs text-canal-gray-muted">Passe : {event.assist_player_name}</p>}
            {event.detail && <p className="text-xs text-canal-gray-muted">{event.detail}</p>}
          </div>
          <span className="text-canal-yellow font-black text-sm shrink-0">{event.minute}'</span>
          <span className="text-xs text-canal-gray-muted w-16 text-right truncate shrink-0">{teamA}</span>
        </>
      ) : (
        <>
          <span className="text-xs text-canal-gray-muted w-16 truncate shrink-0">{teamB}</span>
          <span className="text-canal-yellow font-black text-sm shrink-0">{event.minute}'</span>
          <div className="flex-1 min-w-0 text-right">
            <p className="text-sm font-bold text-white truncate">{event.player_name}</p>
            {event.assist_player_name && <p className="text-xs text-canal-gray-muted">Passe : {event.assist_player_name}</p>}
            {event.detail && <p className="text-xs text-canal-gray-muted">{event.detail}</p>}
          </div>
          <span className="text-lg w-7 text-right">{icon}</span>
        </>
      )}
    </div>
  );
}

function Timeline({ events, teamA, teamB }: { events: MatchEvent[]; teamA: string; teamB: string }) {
  if (!events.length) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">Aucun événement pour l'instant.</p>
  );
  return (
    <div className="space-y-1 py-2">
      {[...events].sort((a, b) => b.minute - a.minute).map((e, i) => (
        <EventRow key={i} event={e} teamA={teamA} teamB={teamB} />
      ))}
    </div>
  );
}

function PlayerRow({ player }: { player: LineupPlayer }) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-lg",
      player.is_starting ? "bg-canal-gray-mid" : "opacity-50"
    )}>
      <span className="text-xs text-canal-gray-muted w-5 text-center font-bold">{player.shirt_number}</span>
      <span className="text-xs text-white font-bold truncate flex-1">{player.player_name}</span>
      <span className="text-xs text-canal-gray-muted">{player.position}</span>
    </div>
  );
}

function Lineups({ lineups }: { lineups: NonNullable<FullMatchDetail["lineups"]> }) {
  const homeStarters = lineups.home.filter((p) => p.is_starting);
  const homeBench = lineups.home.filter((p) => !p.is_starting);
  const awayStarters = lineups.away.filter((p) => p.is_starting);
  const awayBench = lineups.away.filter((p) => !p.is_starting);

  return (
    <div className="py-2 space-y-4">
      {lineups.home_formation && lineups.away_formation && (
        <div className="flex justify-between text-xs text-canal-gray-muted px-1">
          <span className="font-bold">{lineups.home_formation}</span>
          <span className="font-bold">{lineups.away_formation}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {(["home", "away"] as const).map((side) => {
          const starters = side === "home" ? homeStarters : awayStarters;
          const bench = side === "home" ? homeBench : awayBench;
          const coach = side === "home" ? lineups.home_coach : lineups.away_coach;
          return (
            <div key={side}>
              {coach && <p className="text-xs text-canal-gray-muted mb-2 px-1">Coach : {coach}</p>}
              <div className="space-y-1">
                {starters.map((p, i) => <PlayerRow key={i} player={p} />)}
              </div>
              {bench.length > 0 && (
                <>
                  <p className="text-xs text-canal-gray-muted mt-2 mb-1 px-1">Banc</p>
                  <div className="space-y-1">{bench.map((p, i) => <PlayerRow key={i} player={p} />)}</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stats({ stats, teamA, teamB }: { stats: FullMatchDetail["stats"]; teamA: string; teamB: string }) {
  if (!stats.length) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">Stats disponibles après le coup d'envoi.</p>
  );
  return (
    <div className="py-2 space-y-4">
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
              <div className="bg-canal-yellow rounded-l-full transition-all" style={{ width: `${homePct}%` }} />
              <div className="flex-1 bg-canal-gray-light rounded-r-full" />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-xs text-canal-gray-muted">{teamA}</span>
              <span className="text-xs text-canal-gray-muted">{teamB}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Standings({ rows }: { rows: StandingRow[] }) {
  const groups = Array.from(new Set(rows.map((r) => r.group_name))).sort();
  if (!groups.length) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">Classement disponible après la phase de groupes.</p>
  );
  return (
    <div className="py-2 space-y-6">
      {groups.map((group) => {
        const groupRows = rows.filter((r) => r.group_name === group).sort((a, b) => a.rank - b.rank);
        return (
          <div key={group}>
            <p className="text-xs font-black text-canal-yellow uppercase tracking-wider mb-2">{group}</p>
            <div className="space-y-1">
              {groupRows.map((r, i) => (
                <div key={i} className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs",
                  i < 2 ? "bg-canal-gray-mid" : "bg-transparent"
                )}>
                  <span className={cn("font-black w-4 text-center", i < 2 ? "text-canal-yellow" : "text-canal-gray-muted")}>{r.rank}</span>
                  <span className="text-base">{r.team_flag ?? "🏳️"}</span>
                  <span className="font-bold text-white flex-1 truncate">{r.team_name_fr ?? r.team_name}</span>
                  <span className="text-canal-gray-muted w-6 text-center">{r.played}</span>
                  <span className="text-canal-gray-muted w-6 text-center">{r.won}</span>
                  <span className="text-canal-gray-muted w-6 text-center">{r.draw}</span>
                  <span className="text-canal-gray-muted w-6 text-center">{r.lost}</span>
                  <span className="text-canal-gray-muted w-8 text-center">{r.goal_diff > 0 ? `+${r.goal_diff}` : r.goal_diff}</span>
                  <span className="font-black text-white w-6 text-center">{r.points}</span>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 text-xs text-canal-gray-muted">
                <span className="w-4" /><span className="text-base opacity-0">🏳️</span>
                <span className="flex-1" />
                <span className="w-6 text-center">J</span>
                <span className="w-6 text-center">G</span>
                <span className="w-6 text-center">N</span>
                <span className="w-6 text-center">P</span>
                <span className="w-8 text-center">Diff</span>
                <span className="w-6 text-center">Pts</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ratingClass(r: number | null): string {
  if (r == null) return "bg-canal-gray-mid text-canal-gray-muted";
  if (r >= 7.5) return "bg-green-500/20 text-green-400 border border-green-500/40";
  if (r >= 6.5) return "bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30";
  return "bg-red-500/15 text-red-400 border border-red-500/30";
}

function PlayerStatRow({ p }: { p: PlayerMatchStat }) {
  const badges = [
    ...Array(p.goals).fill("⚽"),
    ...Array(p.assists).fill("🅰️"),
    ...Array(p.yellow_cards).fill("🟨"),
    ...Array(p.red_cards).fill("🟥"),
  ].join(" ");
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canal-gray-mid">
      <span className="text-xs text-white font-bold truncate flex-1">{p.player_name}</span>
      {badges && <span className="text-[11px] shrink-0">{badges}</span>}
      <span className={cn("text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0", ratingClass(p.rating))}>
        {p.rating != null ? p.rating.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function TopPlayers({ players, teamA, teamB }: { players: PlayerMatchStat[]; teamA: string; teamB: string }) {
  if (!players.length) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">
      Notes joueurs disponibles après le match.
    </p>
  );

  const estimated = players.some((p) => p.source !== "api-football");
  const motm = players.find((p) => p.is_motm) ?? null;
  const sortByRating = (arr: PlayerMatchStat[]) =>
    [...arr].sort((x, y) => (y.rating ?? 0) - (x.rating ?? 0));
  const home = sortByRating(players.filter((p) => p.team_side === "home"));
  const away = sortByRating(players.filter((p) => p.team_side === "away"));

  return (
    <div className="py-2 space-y-4">
      {estimated && (
        <p className="text-[11px] text-canal-gray-muted italic text-center">
          Notes estimées (analyse Canal Cup) — non officielles.
        </p>
      )}
      {motm && (
        <div className="rounded-2xl bg-gradient-to-br from-canal-yellow/15 to-canal-gray border border-canal-yellow/30 px-4 py-3 flex items-center gap-3">
          <Star size={20} className="text-canal-yellow shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-black text-canal-yellow uppercase tracking-wider">Joueur du match</p>
            <p className="text-sm font-black text-white truncate">{motm.player_name}</p>
          </div>
          <span className={cn("text-base font-black tabular-nums px-2 py-1 rounded", ratingClass(motm.rating))}>
            {motm.rating != null ? motm.rating.toFixed(1) : "—"}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {[{ label: teamA, list: home }, { label: teamB, list: away }].map(({ label, list }) => (
          <div key={label}>
            <p className="text-xs font-black text-canal-yellow uppercase tracking-wider mb-2 truncate">{label}</p>
            <div className="space-y-1">
              {list.map((p, i) => <PlayerStatRow key={`${p.player_name}-${i}`} p={p} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PredictionTrend({ matchId }: { matchId: string }) {
  const [data, setData] = useState<{ total: number; a: number; draw: number; b: number; exact: number | null; finished: boolean } | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${matchId}/predictions-trend`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [matchId]);

  if (!data) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">Chargement des pronostics…</p>
  );
  if (!data.total) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">
      Aucun pronostic Canal Cup sur ce match pour l'instant.
    </p>
  );

  const pct = (n: number) => Math.round((n / data.total) * 100);
  const bars = [
    { label: "Victoire 1", n: data.a, color: "bg-canal-yellow" },
    { label: "Match nul", n: data.draw, color: "bg-canal-gray-light" },
    { label: "Victoire 2", n: data.b, color: "bg-canal-yellow" },
  ];

  return (
    <div className="py-2 space-y-4">
      <p className="text-xs text-canal-gray-muted text-center">
        {data.total} pronostic{data.total > 1 ? "s" : ""} Canal Cup
      </p>
      <div className="space-y-3">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white font-bold">{bar.label}</span>
              <span className="text-canal-gray-muted">{pct(bar.n)}% · {bar.n}</span>
            </div>
            <div className="h-2 bg-canal-gray-mid rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", bar.color)} style={{ width: `${pct(bar.n)}%` }} />
            </div>
          </div>
        ))}
      </div>
      {data.finished && data.exact != null && (
        <div className="rounded-xl bg-canal-gray-mid px-4 py-3 text-center">
          <p className="text-2xl font-black text-canal-yellow tabular-nums">{data.exact}</p>
          <p className="text-xs text-canal-gray-muted">score{data.exact > 1 ? "s" : ""} exact{data.exact > 1 ? "s" : ""} sur {data.total}</p>
        </div>
      )}
    </div>
  );
}

function RobertStory({ matchId, isFinished }: { matchId: string; isFinished: boolean }) {
  const [story, setStory] = useState<{ phrase: string } | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!isFinished || tried) return;
    setTried(true);
    fetch(`/api/matches/${matchId}/story`)
      .then((r) => r.json())
      .then((d) => { if (d.story) setStory(d.story); })
      .catch(() => {});
  }, [matchId, isFinished, tried]);

  if (!story) return null;

  return (
    <div className="mx-4 my-3 px-4 py-3 rounded-2xl bg-gradient-to-br from-canal-gray-mid to-canal-gray border border-canal-yellow/20">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} className="text-canal-yellow" />
        <span className="text-xs font-black text-canal-yellow uppercase tracking-wider">Robert commente</span>
      </div>
      <p className="text-sm text-white font-medium leading-snug italic">"{story.phrase}"</p>
    </div>
  );
}

export default function MatchCenterPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<FullMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/matches/${id}`);
    if (res.ok) { setDetail(await res.json()); setLastUpdate(new Date()); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(() => {
      if (detail?.match.status === "live" || detail?.match.status === "halftime") load();
    }, 30000);
    return () => clearInterval(interval);
  }, [load, detail?.match.status]);

  if (loading) return (
    <div className="min-h-screen bg-canal-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!detail) return (
    <div className="min-h-screen bg-canal-black flex items-center justify-center">
      <p className="text-canal-gray-muted">Match introuvable.</p>
    </div>
  );

  const { match, events, lineups, stats, playerStats, standings } = detail;
  const isLive = match.status === "live" || match.status === "halftime";

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "timeline", label: "Timeline", count: events.length || undefined },
    { key: "lineups", label: "Compos" },
    { key: "stats", label: "Stats", count: stats.length || undefined },
    { key: "notes", label: "Notes", count: playerStats.length || undefined },
    { key: "pronos", label: "Pronos" },
    { key: "standings", label: "Groupe" },
  ];

  return (
    <div className="min-h-screen bg-canal-black">
      <ScoreBoard detail={detail} />

      {isLive && lastUpdate && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 bg-red-950/20 border-b border-red-900/20">
          <RefreshCw size={10} className="text-red-400" />
          <span className="text-xs text-red-400">
            {lastUpdate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · auto 30s
          </span>
        </div>
      )}

      {/* Réactions emoji */}
      <MatchReactions matchId={match.id} isLive={isLive} />

      {/* Robert — commentaire IA post-match */}
      {match.status === "finished" && (
        <RobertStory matchId={match.id} isFinished={true} />
      )}

      {/* Countdown avant coup d'envoi */}
      {match.status === "upcoming" && (
        <div className="flex items-center justify-center gap-2 py-3 border-b border-canal-gray-light">
          <Clock size={13} className="text-canal-yellow" />
          <span className="text-sm text-canal-gray-muted">Coup d'envoi dans</span>
          <Countdown startsAt={match.starts_at} />
        </div>
      )}

      <div className="flex border-b border-canal-gray-light sticky top-0 bg-canal-black z-10">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-3 text-xs font-bold transition-colors relative",
              tab === t.key ? "text-canal-yellow border-b-2 border-canal-yellow" : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
            {t.count ? <span className="ml-1 text-canal-gray-muted">({t.count})</span> : null}
          </button>
        ))}
      </div>

      <div className="px-4 pb-8 max-w-2xl mx-auto">
        {tab === "timeline" && <Timeline events={events} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "lineups" && (
          lineups
            ? <Lineups lineups={lineups} />
            : <p className="text-center text-canal-gray-muted text-sm py-12">Compositions disponibles avant le coup d'envoi.</p>
        )}
        {tab === "stats" && <Stats stats={stats} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "notes" && <TopPlayers players={playerStats} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "pronos" && <PredictionTrend matchId={match.id} />}
        {tab === "standings" && <Standings rows={(standings ?? []) as StandingRow[]} />}
      </div>

      {match.status === "upcoming" && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-canal-black/90 border border-canal-gray-light rounded-full px-4 py-2 shadow-xl">
            <Clock size={14} className="text-canal-yellow" />
            <span className="text-sm text-white font-bold">
              {new Date(match.starts_at).toLocaleString("fr-FR", {
                weekday: "short", day: "numeric", month: "short",
                hour: "2-digit", minute: "2-digit", timeZone: "Pacific/Noumea",
              })} NC
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
