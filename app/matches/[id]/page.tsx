"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { cn, toNCDate, toNCTime } from "@/lib/utils";
import { useTimezone } from "@/components/timezone/TimezoneProvider";
import { statLabelFr, eventDetailFr } from "@/lib/football/labels";
import { toFrench } from "@/lib/football/team-names";
import type { FullMatchDetail, MatchEvent, PlayerMatchStat, StandingRow, TeamSide } from "@/services/football/types";
import { PitchLineup } from "@/components/matches/PitchLineup";
import { MapPin, User, RefreshCw, Clock, Sparkles, Star, Target } from "lucide-react";
import { MatchReactions } from "@/components/matches/MatchReactions";
import { MatchComments } from "@/components/matches/MatchComments";
import { Countdown } from "@/components/matches/Countdown";
import { TeamLink } from "@/components/teams/TeamLink";
import { PlayerSheet } from "@/components/football/PlayerSheet";
import { HotColdPlayers } from "@/components/football/HotColdPlayers";
import { MatchRatingsRecap } from "@/components/football/MatchRatingsRecap";
import { MatchFacts } from "@/components/football/MatchFacts";
import type { MatchPerf } from "@/components/football/PlayerCardView";
import { track } from "@/lib/analytics/track";
import { buildPlayerResolver } from "@/lib/football/resolve-player";
import { getVarWindowMatchIds } from "@/lib/jokers/var-windows-client";

type Tab = "timeline" | "stats" | "notes" | "pronos" | "chat" | "standings" | "facts";

// Contexte « clic joueur » threadé dans les sous-composants : résout un nom en
// api_football_id (depuis les notes/compos en mémoire) et ouvre le bottom sheet.
interface PlayersCtx {
  resolveId: (name: string) => string | undefined;
  open: (playerId: string, name: string) => void;
}

// Nom de joueur cliquable → fiche football (si l'id est résolvable, sinon texte).
function PlayerName({
  name,
  id,
  players,
  className,
}: {
  name: string;
  id?: string;
  players?: PlayersCtx;
  className?: string;
}) {
  const pid = id ?? (name ? players?.resolveId(name) : undefined);
  if (!players || !pid || !name) return <span className={className}>{name}</span>;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); players.open(pid, name); }}
      className={cn(className, "hover:text-canal-yellow transition-colors cursor-pointer")}
    >
      {name}
    </button>
  );
}

const EVENT_ICONS: Record<string, string> = {
  goal: "⚽", yellow_card: "🟨", red_card: "🟥",
  substitution: "🔄", var: "📺", penalty: "🎯", penalty_missed: "❌",
};
const EVENT_LABELS: Record<string, string> = {
  goal: "But", yellow_card: "Carton jaune", red_card: "Carton rouge",
  substitution: "Remplacement", var: "VAR", penalty: "Penalty", penalty_missed: "Penalty manqué",
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

function ScorerList({ list, players }: { list: { name: string; mins: string }[]; players?: PlayersCtx }) {
  if (!list.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs text-center leading-tight">
      {list.map((s, i) => (
        <li key={i}>
          <span className="mr-1">⚽</span>
          <PlayerName name={s.name} players={players} className="text-white font-semibold" />{" "}
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

function ScoreBoard({ detail, players }: { detail: FullMatchDetail; players?: PlayersCtx }) {
  const { match } = detail;
  const { tz } = useTimezone();
  const scorers = buildScorers(detail.events);
  const timeStr = toNCTime(match.starts_at, tz);
  const dateStr = toNCDate(match.starts_at, tz);
  const hasScore = match.score_a !== null && match.score_b !== null;
  // Normalise le nom (ex. "Czechia" → "République Tchèque") pour l'affichage,
  // le drapeau (fallback sur le nom) et surtout le lien vers la fiche effectif.
  const teamAFr = toFrench(match.team_a);
  const teamBFr = toFrench(match.team_b);

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
            name={teamAFr}
            flag={match.flag_a}
            stacked
            flagClassName="text-6xl"
            className="text-sm font-black text-white text-center leading-tight max-w-full"
            wrapperClassName="gap-2 max-w-full"
          />
          <ScorerList list={scorers.home} players={players} />
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
            name={teamBFr}
            flag={match.flag_b}
            stacked
            flagClassName="text-6xl"
            className="text-sm font-black text-white text-center leading-tight max-w-full"
            wrapperClassName="gap-2 max-w-full"
          />
          <ScorerList list={scorers.away} players={players} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-canal-gray-muted flex-wrap">
        {match.venue && <span className="flex items-center gap-1"><MapPin size={11} /> {match.venue}</span>}
        {match.referee && <span className="flex items-center gap-1"><User size={11} /> {match.referee}</span>}
      </div>
    </div>
  );
}

function EventRow({ event, teamA, teamB, players }: { event: MatchEvent; teamA: string; teamB: string; players?: PlayersCtx }) {
  const isHome = event.team_side === "home";
  const icon = EVENT_ICONS[event.type] ?? "•";
  const colorClass = EVENT_COLORS[event.type] ?? "";

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-xl", colorClass)}>
      {isHome ? (
        <>
          <span className="text-lg w-7">{icon}</span>
          <div className="flex-1 min-w-0">
            <PlayerName name={event.player_name} players={players} className="text-sm font-bold text-white truncate block" />
            {event.assist_player_name && <p className="text-xs text-canal-gray-muted">Passe : <PlayerName name={event.assist_player_name} players={players} className="text-canal-gray-muted" /></p>}
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
            <PlayerName name={event.player_name} players={players} className="text-sm font-bold text-white truncate block ml-auto" />
            {event.assist_player_name && <p className="text-xs text-canal-gray-muted">Passe : <PlayerName name={event.assist_player_name} players={players} className="text-canal-gray-muted" /></p>}
            {event.detail && <p className="text-xs text-canal-gray-muted">{eventDetailFr(event.detail)}</p>}
          </div>
          <span className="text-lg w-7 text-right">{icon}</span>
        </>
      )}
    </div>
  );
}

function Timeline({ events, teamA, teamB, players }: { events: MatchEvent[]; teamA: string; teamB: string; players?: PlayersCtx }) {
  if (!events.length) return (
    <p className="text-center text-canal-gray-muted text-sm py-12">Aucun événement pour l'instant.</p>
  );
  return (
    <div className="space-y-1 py-2">
      {[...events].sort((a, b) => b.minute - a.minute).map((e, i) => (
        <EventRow key={i} event={e} teamA={teamA} teamB={teamB} players={players} />
      ))}
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

function PlayerStatRow({ p, players }: { p: PlayerMatchStat; players?: PlayersCtx }) {
  const badges = [
    ...Array(p.goals).fill("⚽"),
    ...Array(p.assists).fill("🅰️"),
    ...Array(p.yellow_cards).fill("🟨"),
    ...Array(p.red_cards).fill("🟥"),
  ].join(" ");
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canal-gray-mid">
      <PlayerName name={p.player_name} id={p.player_id} players={players} className="text-xs text-white font-bold truncate flex-1 text-left" />
      {badges && <span className="text-[11px] shrink-0">{badges}</span>}
      <span className={cn("text-xs font-black tabular-nums px-1.5 py-0.5 rounded shrink-0", ratingClass(p.rating))}>
        {p.rating != null ? p.rating.toFixed(1) : "—"}
      </span>
    </div>
  );
}

function TopPlayers({ players, teamA, teamB, playersCtx }: { players: PlayerMatchStat[]; teamA: string; teamB: string; playersCtx?: PlayersCtx }) {
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
              {list.map((p, i) => <PlayerStatRow key={`${p.player_name}-${i}`} p={p} players={playersCtx} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PredOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";
interface PredDetail {
  user_id?: string | null;
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
                  {d.user_id ? (
                    <Link href={`/joueur/${d.user_id}`} className="flex-1 min-w-0 truncate text-sm font-bold text-white hover:text-canal-yellow transition-colors">{d.name}</Link>
                  ) : (
                    <span className="flex-1 min-w-0 truncate text-sm font-bold text-white">{d.name}</span>
                  )}
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
  const [notesView, setNotesView] = useState<"pitch" | "list">("pitch");
  const [myPred, setMyPred] = useState<{ predicted_score_a: number; predicted_score_b: number } | null>(null);
  const [sheet, setSheet] = useState<{ id: string; perf?: MatchPerf } | null>(null);
  const [varActive, setVarActive] = useState(false);
  const [editPA, setEditPA] = useState<string>("");
  const [editPB, setEditPB] = useState<string>("");
  const [savingPred, setSavingPred] = useState(false);
  const [predMsg, setPredMsg] = useState<string | null>(null);

  // 🎥 Fenêtre VAR active sur ce match ? (refetch frais pour refléter un joker
  // tout juste joué). Permet d'éditer le prono ICI pendant la 1re période/mi-temps.
  useEffect(() => {
    if (!id) return;
    getVarWindowMatchIds(true).then((set) => setVarActive(set.has(id)));
  }, [id]);

  // Pré-remplit les champs d'édition VAR avec le prono actuel.
  useEffect(() => {
    if (myPred) { setEditPA(String(myPred.predicted_score_a)); setEditPB(String(myPred.predicted_score_b)); }
  }, [myPred]);

  // Onglet initial depuis l'URL (?tab=chat) — utilisé par les notifications push.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    const valid: Tab[] = ["timeline", "stats", "notes", "pronos", "chat", "standings", "facts"];
    if (t && (valid as string[]).includes(t)) setTab(t as Tab);
  }, []);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const isLive = detail?.match.status === "live" || detail?.match.status === "halftime";

  // Mon prono sur ce match (affiché sous le score)
  useEffect(() => {
    if (!id) return;
    fetch(`/api/predictions`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = (d?.predictions ?? []).find((x: { match_id: string }) => x.match_id === id);
        setMyPred(p ? { predicted_score_a: p.predicted_score_a, predicted_score_b: p.predicted_score_b } : null);
      })
      .catch(() => {});
  }, [id]);

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

  // Noms normalisés (ex. "Czechia" → "République Tchèque") : affichage, drapeaux
  // et lien vers la fiche effectif. La base peut contenir un libellé fournisseur
  // non traduit ; on le corrige ici plutôt que de propager l'erreur.
  const teamA = toFrench(match.team_a);
  const teamB = toFrench(match.team_b);

  // 🎥 Édition du prono via joker VAR : 1re période + mi-temps (pas la 2e ni fini).
  const inVarWindow =
    match.status === "halftime" || (match.status === "live" && (match.minute == null || match.minute <= 45));
  const varEditable = varActive && inVarWindow;

  const saveVarPred = async () => {
    const a = parseInt(editPA, 10), b = parseInt(editPB, 10);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return;
    setSavingPred(true); setPredMsg(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ match_id: match.id, predicted_score_a: a, predicted_score_b: b }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setPredMsg(d?.error ?? "Échec de l'enregistrement."); return; }
      setMyPred({ predicted_score_a: a, predicted_score_b: b });
      setPredMsg("Prono mis à jour ✓");
    } catch { setPredMsg("Réseau indisponible."); }
    finally { setSavingPred(false); }
  };

  // ── Clic joueur → fiche football ─────────────────────────────────────────
  // Résolution nom → api_football_id depuis les données déjà en mémoire
  // (notes + compos). Les events/buteurs n'ont qu'un nom → on retombe dessus.
  // Résolveur nom → id TOLÉRANT aux abréviations ("M. Oyarzabal" ↔ "Mikel
  // Oyarzabal") : les events de but donnent souvent le nom abrégé.
  const resolveId = buildPlayerResolver([
    ...playerStats.map((p) => ({ name: p.player_name, id: p.player_id })),
    ...(lineups ? [...lineups.home, ...lineups.away].map((p) => ({ name: p.player_name, id: p.player_id })) : []),
  ]);

  const buildPerf = (playerId: string, name: string): MatchPerf | undefined => {
    const stat = playerStats.find((p) => p.player_id === playerId) ?? playerStats.find((p) => p.player_name.toLowerCase() === name.toLowerCase());
    if (!stat) return undefined;
    const lname = stat.player_name.toLowerCase();
    const timeline = events
      .filter((e) =>
        (e.player_name ?? "").toLowerCase().includes(lname) ||
        (e.assist_player_name ?? "").toLowerCase() === lname
      )
      .sort((a, b) => a.minute - b.minute)
      .map((e) => {
        const isAssist = (e.assist_player_name ?? "").toLowerCase() === lname && (e.player_name ?? "").toLowerCase() !== lname;
        return {
          minute: e.minute,
          icon: isAssist ? "🎯" : (EVENT_ICONS[e.type] ?? "•"),
          label: isAssist ? "Passe décisive" : (eventDetailFr(e.detail ?? "") || EVENT_LABELS[e.type] || "Événement"),
        };
      });
    return {
      matchId: match.id, teamA, teamB, scoreA: match.score_a, scoreB: match.score_b,
      rating: stat.rating, minutes: stat.minutes ?? null, started: stat.started ?? null,
      goals: stat.goals, assists: stat.assists, yellowCards: stat.yellow_cards, redCards: stat.red_cards,
      shots: stat.shots, passes: stat.passes, keyPasses: stat.key_passes ?? null,
      dribbles: stat.dribbles, duelsWon: stat.duels_won ?? null, timeline,
    };
  };

  const players: PlayersCtx = {
    resolveId,
    open: (playerId: string, name: string) => setSheet({ id: playerId, perf: buildPerf(playerId, name) }),
  };

  // Match test (amical/démo) = phase "Groupe" SANS stage. Les vrais matchs de
  // poule portent un stage ("Groupe A/B…") ; les matchs à élimination directe
  // ont une autre phase. On masque l'onglet "Groupe" (classement) pour ces
  // matchs test, qui n'appartiennent à aucune poule.
  const isGroupMatch = (match.phase === "Groupe" || match.phase === "Group Stage") && !!match.stage;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "timeline", label: "Timeline" },
    { key: "stats", label: "Stats" },
    { key: "notes", label: "Notes" },
    { key: "pronos", label: "Pronos" },
    { key: "chat", label: "Chat", count: chatUnread || undefined },
    ...(isGroupMatch ? [{ key: "standings" as Tab, label: "Groupe" }] : []),
    { key: "facts", label: "Le saviez-vous" },
  ];

  return (
    <div className="min-h-screen bg-canal-black">
      {sheet && (
        <PlayerSheet playerId={sheet.id} matchPerf={sheet.perf} onClose={() => setSheet(null)} />
      )}
      <ScoreBoard detail={detail} players={players} />

      {varEditable ? (
        <div className="flex flex-col items-center gap-1.5 py-2.5 bg-canal-yellow/10 border-b border-canal-yellow/25">
          <span className="text-xs text-canal-yellow font-black flex items-center gap-1.5">🎥 VAR — modifie ton prono (jusqu&apos;au coup d&apos;envoi de la 2e période)</span>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="numeric" min={0} max={20} value={editPA}
              onChange={(e) => setEditPA(e.target.value)} onFocus={(e) => e.currentTarget.select()}
              className="w-12 h-9 text-center text-lg font-black text-white bg-canal-gray-mid border border-canal-gray-light rounded-lg focus:border-canal-yellow outline-none" />
            <span className="text-canal-gray-muted font-bold">–</span>
            <input type="number" inputMode="numeric" min={0} max={20} value={editPB}
              onChange={(e) => setEditPB(e.target.value)} onFocus={(e) => e.currentTarget.select()}
              className="w-12 h-9 text-center text-lg font-black text-white bg-canal-gray-mid border border-canal-gray-light rounded-lg focus:border-canal-yellow outline-none" />
            <button onClick={saveVarPred} disabled={savingPred || editPA === "" || editPB === ""}
              className="px-3 h-9 rounded-lg bg-canal-yellow text-canal-black text-xs font-black disabled:opacity-40">
              {savingPred ? "…" : "Enregistrer"}
            </button>
          </div>
          {predMsg && <span className="text-[11px] text-canal-gray-muted">{predMsg}</span>}
        </div>
      ) : myPred ? (
        <div className="flex items-center justify-center gap-2 py-2 bg-canal-yellow/5 border-b border-canal-yellow/15">
          <Target size={12} className="text-canal-yellow" />
          <span className="text-xs text-canal-gray-muted">Mon prono</span>
          <span className="text-sm font-black text-white tabular-nums">
            {myPred.predicted_score_a}–{myPred.predicted_score_b}
          </span>
        </div>
      ) : null}

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

      {/* 👀 Joueurs à surveiller (chauds/froids) — avant et pendant le match */}
      {match.status !== "finished" && match.status !== "postponed" && (
        <HotColdPlayers matchId={match.id} onPlayer={(pid, name) => players.open(pid, name)} />
      )}

      {/* ⭐ Récap notes — match terminé : joueurs importants + les moins en vue */}
      {match.status === "finished" && (
        <MatchRatingsRecap playerStats={playerStats} onPlayer={(pid, name) => players.open(pid, name)} />
      )}

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
          <button key={t.key} onClick={() => { setTab(t.key); track(`/matches/${id}#${t.key}`); }}
            className={cn(
              "flex-1 min-w-0 px-0.5 py-3 text-[10px] sm:text-base font-black leading-tight transition-colors relative",
              tab === t.key ? "text-canal-yellow border-b-2 border-canal-yellow" : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
            {t.key === "chat" && t.count ? (
              <span className="ml-1.5 inline-flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-canal-yellow text-canal-black text-[10px] font-black tabular-nums">
                {t.count > 99 ? "99+" : t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="px-4 pb-8 max-w-2xl mx-auto">
        {tab === "timeline" && <Timeline events={events} teamA={teamA} teamB={teamB} players={players} />}
        {tab === "stats" && <Stats stats={stats} teamA={teamA} teamB={teamB} />}
        {tab === "notes" && (
          <div className="py-2">
            <div className="flex gap-1 bg-canal-gray rounded-xl p-1 mb-3 w-fit mx-auto">
              {(["pitch", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setNotesView(v)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-colors",
                    notesView === v ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
                  )}
                >
                  {v === "pitch" ? "⚽ Terrain" : "📋 Liste"}
                </button>
              ))}
            </div>
            {notesView === "pitch" ? (
              lineups ? (
                <PitchLineup lineups={lineups} playerStats={playerStats} events={events} teamA={teamA} teamB={teamB} onPlayerClick={(id, name) => players.open(id, name)} />
              ) : (
                <p className="text-center text-canal-gray-muted text-sm py-12">
                  Terrain disponible dès la publication des compositions (~40 min avant le coup d&apos;envoi).
                </p>
              )
            ) : (
              <TopPlayers players={playerStats} teamA={teamA} teamB={teamB} playersCtx={players} />
            )}
          </div>
        )}
        {tab === "pronos" && <PredictionTrend matchId={match.id} />}
        {tab === "chat" && <MatchComments matchId={match.id} isLive={isLive} onUnreadChange={setChatUnread} />}
        {tab === "standings" && <Standings rows={(standings ?? []) as StandingRow[]} />}
        {tab === "facts" && <MatchFacts matchId={match.id} />}
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
