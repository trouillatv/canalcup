"use client";

import Link from "next/link";
import { toNCDate, toNCTime } from "@/lib/utils";

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
}

interface GroupBucket { stage?: string; matches: MatchRow[] }
interface PhaseSection { phase: string; groups: GroupBucket[] }
export interface BracketData { phases: PhaseSection[]; standings: Record<string, StandingRow[]> }

const NEXT_PHASE: Record<string, string> = {
  Huitièmes: "Quarts de finale",
  Quarts: "Demi-finales",
  Demis: "Finale",
};

const PHASE_EMOJIS: Record<string, string> = {
  Groupe: "⚽", Huitièmes: "🔥", Quarts: "⚡", Demis: "🌟", "3ème place": "🥉", Finale: "🏆",
};

const PHASE_LABELS: Record<string, string> = {
  Groupe: "Phase de Groupes",
  Huitièmes: "Huitièmes de finale",
  Quarts: "Quarts de finale",
  Demis: "Demi-finales",
  "3ème place": "Match pour la 3ème place",
  Finale: "Grande Finale",
};

// ─── Knockout match card ─────────────────────────────────────────────────────

function FifaMatchCard({ match }: { match: MatchRow }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";
  const isTbd = !match.team_a || match.team_a === "TBD";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  const winner =
    isFinished && hasScore && match.score_b !== null && match.score_b !== undefined
      ? match.score_a! > match.score_b! ? "a" : match.score_a! < match.score_b! ? "b" : null
      : null;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`relative rounded-2xl border overflow-hidden transition-all hover:border-canal-yellow/60 cursor-pointer ${
          isLive
            ? "border-red-500/60 bg-gradient-to-r from-red-950/40 via-canal-gray to-red-950/40"
            : isFinished
            ? "border-canal-yellow/25 bg-gradient-to-r from-canal-gray-mid via-canal-gray to-canal-gray-mid"
            : isTbd
            ? "border-canal-gray-light/20 bg-canal-gray/20 opacity-50"
            : "border-canal-gray-light/40 bg-canal-gray-mid/30"
        }`}
        style={isFinished ? { boxShadow: "0 0 24px rgba(255,215,0,0.07)" } : undefined}
      >
        {/* Top glow strip for live */}
        {isLive && (
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500 to-transparent" />
        )}

        <div className="flex items-center py-4 px-4 gap-2">
          {/* Team A */}
          <div className={`flex-1 flex flex-col items-center gap-2 ${winner === "b" ? "opacity-35" : ""}`}>
            <span className="text-5xl leading-none">{match.flag_a ?? "🏳️"}</span>
            <span className={`font-black text-sm text-center leading-tight max-w-20 ${
              winner === "a" ? "text-canal-yellow" : "text-white"
            }`}>
              {isTbd ? "—" : match.team_a}
            </span>
          </div>

          {/* Score / VS center */}
          <div className="flex flex-col items-center gap-1.5 shrink-0 w-28">
            {isLive || (isFinished && hasScore) ? (
              <div className="flex items-center gap-2">
                <span className={`font-black text-4xl tabular-nums ${
                  winner === "a" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                }`}>
                  {match.score_a ?? 0}
                </span>
                <span className="text-canal-gray-muted text-2xl font-bold">–</span>
                <span className={`font-black text-4xl tabular-nums ${
                  winner === "b" ? "text-canal-yellow" : isLive ? "text-red-400" : "text-white"
                }`}>
                  {match.score_b ?? 0}
                </span>
              </div>
            ) : (
              <span className="text-canal-gray-muted text-xl font-black">VS</span>
            )}

            <div className="text-center">
              {isLive ? (
                <span className="text-xs text-red-400 font-black animate-pulse">🔴 EN DIRECT</span>
              ) : isFinished ? (
                <span className="text-xs text-canal-gray-muted">TERMINÉ</span>
              ) : isTbd ? (
                <span className="text-xs text-canal-gray-muted italic">À confirmer</span>
              ) : (
                <span className="text-xs text-canal-gray-muted">
                  {toNCDate(match.starts_at)} · {toNCTime(match.starts_at)}
                </span>
              )}
            </div>
          </div>

          {/* Team B */}
          <div className={`flex-1 flex flex-col items-center gap-2 ${winner === "a" ? "opacity-35" : ""}`}>
            <span className="text-5xl leading-none">{match.flag_b ?? "🏳️"}</span>
            <span className={`font-black text-sm text-center leading-tight max-w-20 ${
              winner === "b" ? "text-canal-yellow" : "text-white"
            }`}>
              {isTbd ? "—" : match.team_b}
            </span>
          </div>
        </div>

        {/* Progression footer */}
        {isFinished && match.phase && NEXT_PHASE[match.phase] && (
          <div className="border-t border-canal-yellow/10 px-4 py-1.5 bg-canal-yellow/5">
            <p className="text-xs text-canal-yellow/60 text-center font-medium tracking-wide">
              Vainqueur → {NEXT_PHASE[match.phase]}
            </p>
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Group standings (visual bars) ───────────────────────────────────────────

function FifaGroupStandings({ rows }: { rows: StandingRow[] }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);
  const maxPts = Math.max(sorted[0]?.points ?? 1, 1);

  return (
    <div className="space-y-1.5 mb-3">
      {sorted.map((row, i) => (
        <div
          key={row.team_name_fr}
          className={`flex items-center gap-2 px-2 py-1.5 rounded-xl transition-colors ${
            i < 2 ? "bg-canal-yellow/10" : ""
          }`}
        >
          <span className={`text-xs font-black w-4 text-center ${i < 2 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
            {i + 1}
          </span>
          <span className="text-base w-6">{row.team_flag}</span>
          <span className={`flex-1 text-xs font-bold truncate ${i < 2 ? "text-white" : "text-canal-gray-muted"}`}>
            {row.team_name_fr}
          </span>
          <div className="w-14 h-1.5 bg-canal-gray-light/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${i < 2 ? "bg-canal-yellow" : "bg-canal-gray-muted/50"}`}
              style={{ width: `${(row.points / maxPts) * 100}%` }}
            />
          </div>
          <span className={`text-xs font-black w-5 text-center ${i < 2 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
            {row.points}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Group match chip (bigger than standard) ──────────────────────────────────

function FifaGroupMatch({ match }: { match: MatchRow }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer hover:border-canal-yellow/40 transition-colors ${
          isLive
            ? "border-red-500/40 bg-red-950/10"
            : "border-canal-gray-light/20 bg-transparent"
        }`}
      >
        <span className="text-xl w-7">{match.flag_a ?? "🏳️"}</span>
        <span className={`text-xs font-bold flex-1 truncate ${isFinished ? "text-canal-gray-muted" : "text-white"}`}>
          {match.team_a}
        </span>
        <div className="shrink-0 w-16 text-center">
          {isLive || (isFinished && hasScore) ? (
            <span className={`text-xs font-black ${isLive ? "text-red-400" : "text-canal-yellow"}`}>
              {match.score_a}–{match.score_b}
            </span>
          ) : (
            <span className="text-xs text-canal-gray-muted">{toNCTime(match.starts_at)}</span>
          )}
        </div>
        <span className={`text-xs font-bold flex-1 text-right truncate ${isFinished ? "text-canal-gray-muted" : "text-white"}`}>
          {match.team_b}
        </span>
        <span className="text-xl w-7 text-right">{match.flag_b ?? "🏳️"}</span>
      </div>
    </Link>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function BracketFifa({ data }: { data: BracketData }) {
  return (
    <div className="space-y-10">
      {data.phases.map((section) => {
        const isGroupe = section.phase === "Groupe";
        const isFinale = section.phase === "Finale";
        const emoji = PHASE_EMOJIS[section.phase] ?? "⚽";
        const label = PHASE_LABELS[section.phase] ?? section.phase;

        return (
          <section key={section.phase}>
            {/* Phase header */}
            <div className={`mb-5 ${isFinale ? "text-center" : ""}`}>
              {isFinale ? (
                <div className="flex flex-col items-center gap-2 mb-3">
                  <span className="text-5xl">{emoji}</span>
                  <h2 className="font-black text-3xl text-canal-yellow uppercase tracking-widest">{label}</h2>
                  <p className="text-canal-gray-muted text-sm">Le moment ultime</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{emoji}</span>
                  <h2 className="font-black text-lg text-white uppercase tracking-wide">{label}</h2>
                </div>
              )}
              <div className="h-px bg-gradient-to-r from-canal-yellow/50 via-canal-yellow/20 to-transparent" />
            </div>

            {isGroupe ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {section.groups.map((bucket) => {
                  const groupLabel = bucket.stage ?? "Groupe";
                  const standingRows =
                    data.standings[groupLabel] ??
                    data.standings[`Group ${groupLabel.replace("Groupe ", "")}`] ??
                    [];
                  return (
                    <div
                      key={groupLabel}
                      className="bg-gradient-to-b from-canal-gray-mid to-canal-gray rounded-2xl border border-canal-gray-light/30 p-4"
                    >
                      <p className="font-black text-canal-yellow text-xs uppercase tracking-widest mb-3">{groupLabel}</p>
                      {standingRows.length > 0 && <FifaGroupStandings rows={standingRows} />}
                      <div className="space-y-1 border-t border-canal-gray-light/20 pt-3">
                        {bucket.matches.map((m) => <FifaGroupMatch key={m.id} match={m} />)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : isFinale ? (
              <div className="max-w-lg mx-auto">
                {section.groups[0]?.matches.map((m) => <FifaMatchCard key={m.id} match={m} />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {section.groups[0]?.matches.map((m) => <FifaMatchCard key={m.id} match={m} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
