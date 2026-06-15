"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { cn, toNCDate, toNCTime } from "@/lib/utils";
import { useTimezone } from "@/components/timezone/TimezoneProvider";
import { statLabelFr, eventDetailFr } from "@/lib/football/labels";
import type { FullMatchDetail, MatchEvent, LineupPlayer, PlayerMatchStat, StandingRow, TeamSide } from "@/services/football/types";
import { PitchLineup } from "@/components/matches/PitchLineup";
import { MapPin, User, RefreshCw, Clock, Sparkles, Star } from "lucide-react";
import { MatchReactions } from "@/components/matches/MatchReactions";
import { MatchComments } from "@/components/matches/MatchComments";
import { Countdown } from "@/components/matches/Countdown";
import { TeamLink } from "@/components/teams/TeamLink";

type Tab = "timeline" | "lineups" | "terrain" | "stats" | "notes" | "pronos" | "chat" | "standings";

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽", yellow_card: "🟨", red_card: "🟥",
  substitution: "🔄", var: "📺", penalty: "🎯", penalty_missed: "❌",
};
const EVENT_COLORS: Record<string, string> = {
  goal: "bg-canal-yellow/10 border border-canal-yellow/20",
  red_card: "bg-red-950/30 border border-red-900/20",
  yellow_card: "bg-yellow-950/20 border border-yellow-900/20",
};

// Agrège les buteurs par camp affiché (home = team_a, away = team_b).
// Inclut buts normaux et penaltys marqués ; un csc est recrédité au camp adverse.
function buildScorers(events: MatchEvent[]) {
  const map: Record<TeamSide, Map<string, string[]>> = { home: new Map(), away: new Map() };
  for (const e of events) {
    if (e.type !== "goal" && e.type !== "penalty") continue;
    const isOwnGoal = (e.detail ?? "").toLowerCase().includes("own");
    const side: TeamSide = isOwnGoal ? (e.team_side === "home" ? "away" : "home") : e.team_side;
    let label = `${e.minute}${e.extra_minute ? `+${e.extra_minute}` : ""}'`;
    if (e.type === "penalty") label += " p";
    if (isOwnGoal) label += " csc";
    const name = e.player_name || "—";
    if (!map[side].has(name)) map[side].set(name, []);
    map[side].get(name)!.push(label);
  }
  const fmt = (m: Map<string, string[]>) =>
    [...m.entries()].map(([name, mins]) => ({ name, mins: mins.join(", ") }));
  return { home: fmt(map.home), away: fmt(map.away) };
}

function ScorerList({ list }: { list: { name: string; mins: string }[] }) {
  if (!list.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-center leading-tight">
      {list.map((s, i) => (
        <li key={i}>
          <span className="mr-1">⚽</span>
          <span className="text-white font-semibold">{s.name}</span>{" "}
          <span className="text-canal-gray-muted">{s.mins}</span>
        </li>
      ))}
    </ul>
  );
}

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
  const { tz } = useTimezone();
  const scorers = buildScorers(detail.events);
  const timeStr = toNCTime(match.starts_at, tz);
  const dateStr = toNCDate(match.starts_at, tz);
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
          <ScorerList list={scorers.home} />
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
          <ScorerList list={scorers.away} />
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
            {event.detail && <p className="text-xs text-canal-gray-muted">{eventDetailFr(event.detail)}</p>}
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
            {event.detail && <p className="text-xs text-canal-gray-muted">{eventDetailFr(event.detail)}</p>}
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
              <span className="text-xs text-canal-gray-muted">{statLabelFr(s.stat_type)}</span>
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
            <p className="text-lg sm:text-2xl font-black text-canal-yellow uppercase tracking-wide mb-3">{group}</p>
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

type PredOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";
interface PredDetail {
  name: string;
  predicted_score_a: number;
  predicted_score_b: number;
  outcome: PredOutcome;
  points: number | null;
}

const OUTCOME_BADGE: Record<PredOutcome, { label: string; cls: string }> = {
  exact: { label: "Score exact 🎯", cls: "text-canal-yellow" },
  correct_result: { label: "Bon résultat ✅", cls: "text-green-400" },
  correct_diff: { label: "Bonne diff ↔", cls: "text-green-400" },
  wrong: { label: "Raté ❌", cls: "text-canal-gray-muted" },
  pending: { label: "En attente", cls: "text-canal-gray-muted" },
};

function PredictionTrend({ matchId }: { matchId: string }) {
  const [data, setData] = useState<{ total: number; started?: boolean; a: number; draw: number; b: number; exact: number | null; finished: boolean; live?: boolean; details?: PredDetail[] } | null>(null);

  useEffect(() => {
    const load = () => {
      fetch(`/api/matches/${matchId}/predictions-trend`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => {});
    };
    load();
    // En live, on suit le score : on rafraîchit le classement toutes les 30 s.
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
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

  // Avant le coup d'envoi : on ne dévoile AUCUN prono (sinon on pourrait copier
  // celui d'un autre). On affiche seulement le nombre de participants.
  if (!data.started) return (
    <div className="py-8 px-4 text-center space-y-2">
      <p className="text-3xl">🔒</p>
      <p className="text-sm font-bold text-white">
        {data.total} pronostic{data.total > 1 ? "s" : ""} Canal Cup enregistré{data.total > 1 ? "s" : ""}
      </p>
      <p className="text-xs text-canal-gray-muted">
        Les pronostics de chacun seront visibles au coup d'envoi — pas avant, pour éviter de copier.
      </p>
    </div>
  );

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
      {(() => {
        const scored = data.finished || !!data.live; // un score est dispo
        return <>
      {scored && data.exact != null && (
        <div className="rounded-xl bg-canal-gray-mid px-4 py-3 text-center">
          <p className="text-2xl font-black text-canal-yellow tabular-nums">{data.exact}</p>
          <p className="text-xs text-canal-gray-muted">
            score{data.exact > 1 ? "s" : ""} exact{data.exact > 1 ? "s" : ""} sur {data.total}
            {data.live && <span className="text-red-400 font-bold"> · en direct</span>}
          </p>
        </div>
      )}

      {/* Détail par personne — classé par points obtenus */}
      {data.details && data.details.length > 0 && (
        <div className="pt-2">
          <h3 className="text-xs font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-2">
            {scored ? "Classement des pronos sur ce match" : "Pronostics de chacun"}
            {data.live && <span className="text-[10px] text-red-400 normal-case font-bold flex items-center gap-1"><span className="live-dot" /> provisoire</span>}
          </h3>
          <div className="space-y-1.5">
            {data.details.map((d, i) => {
              const badge = OUTCOME_BADGE[d.outcome];
              const medal = scored && (d.points ?? 0) > 0
                ? (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null)
                : null;
              return (
                <div
                  key={`${d.name}-${i}`}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canal-gray-mid"
                >
                  <span className="w-6 text-center text-xs font-black text-canal-gray-muted tabular-nums">
                    {medal ?? (scored ? `${i + 1}` : "")}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{d.name}</span>
                  <span className="shrink-0 text-sm font-black text-white tabular-nums">
                    {d.predicted_score_a}–{d.predicted_score_b}
                  </span>
                  <span className={cn("shrink-0 text-[10px] font-bold w-24 text-right", badge.cls)}>
                    {badge.label}
                  </span>
                  {scored && (
                    <span className={cn(
                      "shrink-0 w-12 text-right text-sm font-black tabular-nums",
                      (d.points ?? 0) > 0 ? "text-canal-yellow" : "text-canal-gray-muted"
                    )}>
                      {d.points != null ? `+${d.points}` : "—"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>;
      })()}
    </div>
  );
}

function GoatStory({ matchId, isFinished }: { matchId: string; isFinished: boolean }) {
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
        <span className="text-xs font-black text-canal-yellow uppercase tracking-wider flex items-center gap-1">
          <img src="/goat.png" alt="🐐" className="h-4 w-4 object-contain" /> Le Goat commente
        </span>
      </div>
      <p className="text-sm text-white font-medium leading-snug italic">"{story.phrase}"</p>
    </div>
  );
}

export default function MatchCenterPage() {
  const { id } = useParams<{ id: string }>();
  const { tz, label: tzLbl } = useTimezone();
  const [detail, setDetail] = useState<FullMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("timeline");
  const [chatUnread, setChatUnread] = useState(0);

  // Onglet initial depuis l'URL (?tab=chat) — utilisé par les notifications push.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    const valid: Tab[] = ["timeline", "lineups", "terrain", "stats", "notes", "pronos", "chat", "standings"];
    if (t && (valid as string[]).includes(t)) setTab(t as Tab);
  }, []);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const isLive = detail?.match.status === "live" || detail?.match.status === "halftime";

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

  useEffect(() => {
    if (!id || tab === "chat") return;
    const loadUnread = () => {
      fetch(`/api/matches/${id}/comments?summary=1`, { credentials: "same-origin" })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => setChatUnread(d?.unread ?? 0))
        .catch(() => {});
    };
    loadUnread();
    if (!isLive) return;
    const interval = setInterval(loadUnread, 15000);
    return () => clearInterval(interval);
  }, [id, isLive, tab]);

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

  // Match test (amical/démo) = phase "Groupe" SANS stage. Les vrais matchs de
  // poule portent un stage ("Groupe A/B…") ; les matchs à élimination directe
  // ont une autre phase. On masque l'onglet "Groupe" (classement) pour ces
  // matchs test, qui n'appartiennent à aucune poule.
  const isGroupMatch = (match.phase === "Groupe" || match.phase === "Group Stage") && !!match.stage;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "timeline", label: "Timeline", count: events.length || undefined },
    { key: "lineups", label: "Compos" },
    { key: "terrain", label: "Terrain" },
    { key: "stats", label: "Stats", count: stats.length || undefined },
    { key: "notes", label: "Notes", count: playerStats.length || undefined },
    { key: "pronos", label: "Pronos" },
    { key: "chat", label: "Chat", count: chatUnread || undefined },
    ...(isGroupMatch ? [{ key: "standings" as Tab, label: "Groupe" }] : []),
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

      {/* Le Goat — commentaire IA post-match */}
      {match.status === "finished" && (
        <GoatStory matchId={match.id} isFinished={true} />
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
              "flex-1 min-w-0 px-0.5 py-3 text-[10px] sm:text-base font-black leading-tight transition-colors relative",
              tab === t.key ? "text-canal-yellow border-b-2 border-canal-yellow" : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
            {t.count ? (
              t.key === "chat" ? (
                <span className="ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-canal-yellow text-canal-black text-[10px] font-black tabular-nums">
                  {t.count > 99 ? "99+" : t.count}
                </span>
              ) : (
                <span className="ml-1 text-canal-gray-muted">({t.count})</span>
              )
            ) : null}
          </button>
        ))}
      </div>

      <div className="px-4 pb-8 max-w-2xl mx-auto">
        {tab === "timeline" && <Timeline events={events} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "lineups" && (
          lineups
            ? <Lineups lineups={lineups} />
            : <p className="text-center text-canal-gray-muted text-sm py-12">
                {match.status === "upcoming"
                  ? "Compositions disponibles avant le coup d'envoi."
                  : "Compositions non disponibles pour ce match."}
              </p>
        )}
        {tab === "terrain" && (
          lineups
            ? <PitchLineup lineups={lineups} playerStats={playerStats} events={events} teamA={match.team_a} teamB={match.team_b} />
            : <p className="text-center text-canal-gray-muted text-sm py-12">
                Terrain disponible dès que les compositions officielles sont publiées (~40 min avant le coup d&apos;envoi).
              </p>
        )}
        {tab === "stats" && <Stats stats={stats} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "notes" && <TopPlayers players={playerStats} teamA={match.team_a} teamB={match.team_b} />}
        {tab === "pronos" && <PredictionTrend matchId={match.id} />}
        {tab === "chat" && <MatchComments matchId={match.id} isLive={isLive} onUnreadChange={setChatUnread} />}
        {tab === "standings" && <Standings rows={(standings ?? []) as StandingRow[]} />}
      </div>

      {match.status === "upcoming" && (
        <div className="fixed bottom-20 left-0 right-0 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 bg-canal-black/90 border border-canal-gray-light rounded-full px-4 py-2 shadow-xl">
            <Clock size={14} className="text-canal-yellow" />
            <span className="text-sm text-white font-bold">
              {toNCDate(match.starts_at, tz)} · {toNCTime(match.starts_at, tz)} {tzLbl}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
