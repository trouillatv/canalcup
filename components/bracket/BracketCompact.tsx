"use client";

import Link from "next/link";
import { teamFlag, toNCTime } from "@/lib/utils";

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
  stage?: string;
  phase?: string;
}

interface GroupBucket { stage?: string; matches: MatchRow[] }
interface PhaseSection { phase: string; groups: GroupBucket[] }
export interface BracketCompactData { phases: PhaseSection[] }

const PHASE_SHORT: Record<string, string> = {
  Groupe: "Groupes", Huitièmes: "1/8", Quarts: "1/4",
  Demis: "Demis", "3ème place": "3ème place", Finale: "Finale",
};

function CompactRow({ match }: { match: MatchRow }) {
  const isLive = match.status === "live" || match.status === "halftime";
  const isFinished = match.status === "finished";
  const hasScore = match.score_a !== null && match.score_a !== undefined;

  return (
    <Link href={`/matches/${match.id}`}>
      <div
        className={`flex items-center gap-2 py-1.5 px-2 rounded-lg text-xs hover:bg-canal-gray-light/10 transition-colors cursor-pointer ${
          isLive ? "bg-red-950/20" : ""
        }`}
      >
        <span className="text-sm w-6 shrink-0">{teamFlag(match.flag_a, match.team_a)}</span>
        <span className={`font-semibold flex-1 min-w-0 truncate ${isFinished ? "text-canal-gray-muted" : "text-white"}`}>
          {match.team_a || "—"}
        </span>
        <div className="shrink-0 w-14 text-center">
          {(isLive || isFinished) && hasScore ? (
            <span className={`font-black ${isLive ? "text-red-400" : "text-canal-yellow"}`}>
              {match.score_a}–{match.score_b}
            </span>
          ) : (
            <span className="text-canal-gray-muted">{toNCTime(match.starts_at)}</span>
          )}
        </div>
        <span className={`font-semibold flex-1 min-w-0 truncate text-right ${isFinished ? "text-canal-gray-muted" : "text-white"}`}>
          {match.team_b || "—"}
        </span>
        <span className="text-sm w-6 shrink-0 text-right">{teamFlag(match.flag_b, match.team_b)}</span>
      </div>
    </Link>
  );
}

export function BracketCompact({ data }: { data: BracketCompactData }) {
  return (
    <div className="space-y-4">
      {data.phases.map((section) => (
        <div key={section.phase}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-black text-canal-yellow uppercase tracking-wider">
              {PHASE_SHORT[section.phase] ?? section.phase}
            </span>
            <div className="flex-1 h-px bg-canal-gray-light/30" />
          </div>

          <div className="canal-card p-2 space-y-0.5">
            {section.phase === "Groupe"
              ? section.groups.map((bucket) => (
                  <div key={bucket.stage ?? "groupe"} className="mb-3 last:mb-0">
                    <p className="text-xs text-canal-gray-muted font-bold px-2 py-1">{bucket.stage}</p>
                    {bucket.matches.map((m) => <CompactRow key={m.id} match={m} />)}
                  </div>
                ))
              : section.groups[0]?.matches.map((m) => <CompactRow key={m.id} match={m} />)
            }
          </div>
        </div>
      ))}
    </div>
  );
}
