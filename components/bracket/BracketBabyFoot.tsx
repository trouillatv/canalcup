"use client";

import { cn } from "@/lib/utils";
import type { BabyFootMatch } from "@/lib/supabase/types";

const ROUNDS = ["Groupes", "Quarts", "Demis", "3ème place", "Finale"];
const ROUND_ICONS: Record<string, string> = {
  Groupes: "⚽",
  Quarts: "⚡",
  Demis: "🌟",
  "3ème place": "🥉",
  Finale: "🏆",
};

function TeamCircle({ name, winner, loser }: { name?: string; winner?: boolean; loser?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", loser ? "opacity-40" : "")}>
      <div className={cn(
        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm transition-all",
        winner
          ? "bg-canal-yellow text-canal-black ring-2 ring-canal-yellow/60"
          : "bg-canal-gray-mid text-canal-gray-muted"
      )}>
        {name?.[0] ?? "?"}
      </div>
      <span className={cn(
        "text-sm font-bold truncate",
        winner ? "text-canal-yellow" : "text-white"
      )}>
        {name ?? "???"}
      </span>
    </div>
  );
}

function BabyMatchCard({ match }: { match: BabyFootMatch }) {
  const isFinished = match.status === "finished";
  const winner =
    isFinished && match.score_a !== undefined && match.score_b !== undefined
      ? match.score_a > match.score_b ? "a" : match.score_a < match.score_b ? "b" : null
      : null;

  return (
    <div className={cn(
      "canal-card p-3 space-y-2",
      isFinished ? "border-canal-gray-light/50" : "border-canal-yellow/20"
    )}>
      <div className="flex items-center justify-between gap-2">
        <TeamCircle
          name={match.team_a?.name}
          winner={winner === "a"}
          loser={winner === "b"}
        />
        <div className="shrink-0 text-center">
          {isFinished ? (
            <span className="font-black text-lg text-white tabular-nums">
              <span className={cn(winner === "a" ? "text-canal-yellow" : "")}>
                {match.score_a}
              </span>
              <span className="text-canal-gray-muted mx-1">–</span>
              <span className={cn(winner === "b" ? "text-canal-yellow" : "")}>
                {match.score_b}
              </span>
            </span>
          ) : (
            <span className="text-canal-gray-muted text-xs font-bold">VS</span>
          )}
        </div>
        <TeamCircle
          name={match.team_b?.name}
          winner={winner === "b"}
          loser={winner === "a"}
        />
      </div>
      {match.highlight && (
        <p className="text-xs text-canal-gray-muted italic border-t border-canal-gray-light pt-2">
          💬 {match.highlight}
        </p>
      )}
    </div>
  );
}

export function BracketBabyFoot({ matches }: { matches: BabyFootMatch[] }) {
  const byRound = ROUNDS.reduce<Record<string, BabyFootMatch[]>>((acc, r) => {
    acc[r] = matches.filter((m) => m.round === r);
    return acc;
  }, {});

  const hasAny = ROUNDS.some((r) => byRound[r].length > 0);
  if (!hasAny) {
    return (
      <p className="text-canal-gray-muted text-sm text-center py-8">
        Aucun match dans le tableau. L&apos;admin doit créer les matchs.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {ROUNDS.map((round) => {
        const roundMatches = byRound[round];
        if (!roundMatches.length) return null;

        const isFinale = round === "Finale";

        return (
          <section key={round}>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">{ROUND_ICONS[round] ?? "⚽"}</span>
              <h2 className={cn(
                "font-black uppercase tracking-wide text-sm",
                isFinale ? "text-canal-yellow" : "text-white"
              )}>
                {round}
              </h2>
              <span className="text-xs text-canal-gray-muted">
                ({roundMatches.length} match{roundMatches.length > 1 ? "s" : ""})
              </span>
              {isFinale && (
                <span className="ml-auto text-xs text-canal-yellow font-bold animate-pulse">
                  ✨ Grand Final
                </span>
              )}
            </div>

            <div className={cn(
              "grid gap-3",
              roundMatches.length === 1 ? "grid-cols-1 max-w-sm mx-auto" :
              roundMatches.length === 2 ? "grid-cols-1 sm:grid-cols-2" :
              "grid-cols-1 sm:grid-cols-2"
            )}>
              {roundMatches.map((m) => (
                <BabyMatchCard key={m.id} match={m} />
              ))}
            </div>

            {round !== "Finale" && round !== "3ème place" && byRound[ROUNDS[ROUNDS.indexOf(round) + 1]]?.length > 0 && (
              <div className="flex items-center justify-center mt-4 gap-2 text-canal-gray-muted">
                <div className="h-px flex-1 bg-canal-gray-light/40" />
                <span className="text-xs">
                  {ROUND_ICONS[ROUNDS[ROUNDS.indexOf(round) + 1]]} {ROUNDS[ROUNDS.indexOf(round) + 1]}
                </span>
                <div className="h-px flex-1 bg-canal-gray-light/40" />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
