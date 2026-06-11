"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trophy, CalendarDays } from "lucide-react";
import { LocalTime } from "@/components/timezone/LocalTime";
import { Flag } from "@/components/shared/Flag";
import { ViewSwitcher } from "@/components/views/ViewSwitcher";
import { BracketFifa } from "@/components/bracket/BracketFifa";
import { BracketCompact } from "@/components/bracket/BracketCompact";
import { wcTeamHref } from "@/lib/football/wc-teams-index";

const VIEW_KEY = "bracket-view";

interface MatchRow {
  id: string;
  team_a: string;
  team_b: string;
  flag_a?: string;
  flag_b?: string;
  score_a?: number;
  score_b?: number;
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

interface GroupBucket {
  stage?: string;
  matches: MatchRow[];
}

interface PhaseSection {
  phase: string;
  groups: GroupBucket[];
}

interface BracketData {
  phases: PhaseSection[];
  standings: Record<string, StandingRow[]>;
}

// ─── Standard view components ─────────────────────────────────────────────────

function MatchChip({ match }: { match: MatchRow }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`rounded-xl border p-3 hover:border-canal-yellow/50 transition-colors cursor-pointer ${
          isLive
            ? "border-red-500/60 bg-red-950/20"
            : isFinished
            ? "border-canal-gray-light bg-canal-gray/20"
            : "border-canal-gray-light bg-canal-gray/10"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Flag flag={match.flag_a} name={match.team_a} className="h-5 w-auto rounded-sm leading-none" emojiClassName="text-lg leading-none" />
            <span className="font-semibold text-sm text-white truncate">{match.team_a}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isFinished || isLive ? (
              <>
                <span className={`font-black text-base w-5 text-center ${isLive ? "text-red-400" : "text-canal-yellow"}`}>
                  {match.score_a ?? 0}
                </span>
                <span className="text-canal-gray-muted text-xs">–</span>
                <span className={`font-black text-base w-5 text-center ${isLive ? "text-red-400" : "text-canal-yellow"}`}>
                  {match.score_b ?? 0}
                </span>
              </>
            ) : (
              <span className="text-canal-gray-muted text-xs px-1">VS</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
            <span className="font-semibold text-sm text-white truncate text-right">{match.team_b}</span>
            <Flag flag={match.flag_b} name={match.team_b} className="h-5 w-auto rounded-sm leading-none" emojiClassName="text-lg leading-none" />
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-canal-gray-muted text-xs">
            {isLive ? "🔴 En direct" : <><LocalTime date={match.starts_at} variant="date" /> <LocalTime date={match.starts_at} variant="time" /></>}
          </span>
        </div>
      </div>
    </Link>
  );
}

function GroupStandings({ rows }: { rows: StandingRow[] }) {
  const sorted = [...rows].sort((a, b) => b.points - a.points || b.goal_diff - a.goal_diff);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-canal-gray-muted border-b border-canal-gray-light">
            <th className="text-left pb-1 font-medium w-5">#</th>
            <th className="text-left pb-1 font-medium">Équipe</th>
            <th className="text-center pb-1 font-medium w-6">J</th>
            <th className="text-center pb-1 font-medium w-6">G</th>
            <th className="text-center pb-1 font-medium w-6">N</th>
            <th className="text-center pb-1 font-medium w-6">P</th>
            <th className="text-center pb-1 font-medium w-8">Buts</th>
            <th className="text-center pb-1 font-medium w-6">Diff</th>
            <th className="text-center pb-1 font-bold text-canal-yellow w-6">Pts</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr
              key={row.team_name_fr}
              className={`border-b border-canal-gray-light/30 ${i < 2 ? "text-white" : "text-canal-gray-muted"}`}
            >
              <td className="py-1 text-center font-bold">{i + 1}</td>
              <td className="py-1">
                {(() => {
                  const href = wcTeamHref(row.team_name_fr);
                  const inner = (
                    <span className="flex items-center gap-1">
                      <Flag flag={row.team_flag} name={row.team_name_fr} className="h-4 w-auto rounded-sm" />
                      <span className={i < 2 ? "font-semibold" : ""}>{row.team_name_fr}</span>
                    </span>
                  );
                  return href ? (
                    <Link href={href} className="hover:text-canal-yellow transition-colors" onClick={(e) => e.stopPropagation()}>
                      {inner}
                    </Link>
                  ) : inner;
                })()}
              </td>
              <td className="py-1 text-center">{row.played}</td>
              <td className="py-1 text-center">{row.won}</td>
              <td className="py-1 text-center">{row.draw}</td>
              <td className="py-1 text-center">{row.lost}</td>
              <td className="py-1 text-center">{row.goals_for}:{row.goals_against}</td>
              <td className="py-1 text-center">{row.goal_diff > 0 ? `+${row.goal_diff}` : row.goal_diff}</td>
              <td className="py-1 text-center font-black text-canal-yellow">{row.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="text-canal-gray-muted text-xs text-center py-2">Classement disponible dès le début du tournoi</p>
      )}
    </div>
  );
}

function GroupSection({ bucket, standings }: { bucket: GroupBucket; standings: Record<string, StandingRow[]> }) {
  const groupLabel = bucket.stage ?? "Phase de groupes";
  const standingRows = standings[groupLabel] ?? standings[`Group ${groupLabel.replace("Groupe ", "")}`] ?? [];

  return (
    <div className="canal-card p-4 space-y-4">
      <h3 className="font-black text-canal-yellow text-base uppercase tracking-wider">{groupLabel}</h3>
      {standingRows.length > 0 && <GroupStandings rows={standingRows} />}
      <div className="space-y-2">
        {bucket.matches.map((m) => <MatchChip key={m.id} match={m} />)}
      </div>
    </div>
  );
}

const PHASE_LABELS: Record<string, string> = {
  Groupe: "Phase de Groupes",
  "Huitièmes": "Huitièmes de finale",
  Quarts: "Quarts de finale",
  Demis: "Demi-finales",
  "3ème place": "Match pour la 3ème place",
  Finale: "Finale",
};

const PHASE_ICONS: Record<string, string> = {
  Groupe: "⚽", "Huitièmes": "🔥", Quarts: "⚡",
  Demis: "🌟", "3ème place": "🥉", Finale: "🏆",
};

function BracketStandard({ data }: { data: BracketData }) {
  return (
    <>
      {data.phases.map((section) => (
        <section key={section.phase} className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">{PHASE_ICONS[section.phase] ?? "⚽"}</span>
            <h2 className="font-black text-xl text-white uppercase tracking-wide">
              {PHASE_LABELS[section.phase] ?? section.phase}
            </h2>
          </div>

          {section.phase === "Groupe" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.groups.map((bucket) => (
                <GroupSection key={bucket.stage ?? "groupe"} bucket={bucket} standings={data.standings} />
              ))}
            </div>
          ) : (
            <div className="canal-card p-4 space-y-2">
              {section.groups[0]?.matches.map((m) => <MatchChip key={m.id} match={m} />)}
            </div>
          )}
        </section>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function BracketPageInner() {
  const groupParam = useSearchParams().get("group");
  const [data, setData] = useState<BracketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("fifa");

  // Deep-link "?group=X" (depuis une fiche équipe) → vue fifa sur la poule.
  // Sinon, préférence de vue persistée.
  useEffect(() => {
    if (groupParam) {
      setView("fifa");
      return;
    }
    const saved = localStorage.getItem(VIEW_KEY);
    if (saved) setView(saved);
  }, [groupParam]);

  const handleViewChange = (v: string) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  useEffect(() => {
    fetch("/api/bracket")
      .then((r) => r.json())
      .then((d: BracketData) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-canal-black">
      <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/matches" className="text-canal-gray-muted hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-2xl text-white flex items-center gap-2">
              <Trophy size={22} className="text-canal-yellow" />
              Tableau de la Coupe
            </h1>
            <p className="text-canal-gray-muted text-sm">FIFA World Cup 2026</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/schedule"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-canal-gray-mid text-canal-gray-muted hover:text-white text-xs font-bold transition-colors"
            >
              <CalendarDays size={14} />
              <span className="hidden sm:inline">Calendrier</span>
            </Link>
            <ViewSwitcher view={view} onChange={handleViewChange} modes={["fifa", "compact"]} />
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-canal-yellow border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {data && (
          <>
            {view === "standard" && <BracketStandard data={data} />}
            {view === "fifa" && <BracketFifa data={data} initialGroup={groupParam} />}
            {view === "compact" && <BracketCompact data={data} />}
          </>
        )}

        {data && data.phases.length === 0 && (
          <div className="text-center py-20">
            <p className="text-canal-gray-muted text-lg">Aucun match disponible pour le moment.</p>
            <p className="text-canal-gray-muted text-sm mt-2">Le tableau sera mis à jour au fur et à mesure des confirmations FIFA.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BracketPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canal-black" />}>
      <BracketPageInner />
    </Suspense>
  );
}
