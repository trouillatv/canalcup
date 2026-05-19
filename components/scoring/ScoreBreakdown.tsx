// Décomposition lisible du score d'une équipe : par pilier → brut,
// contribution PONDÉRÉE, poids %, part dans le total. Raconte POURQUOI une
// équipe est forte (pronos / quiz / babyfoot / animations). Réutilisable :
// fiche équipe, ligne classement dépliable, preview admin.
//
// Présentation pure (server component) — alimentée par un LeaderboardRow.

import type { LeaderboardRow } from "@/lib/supabase/types";
import { weightPct } from "@/lib/scoring/config";
import { cn } from "@/lib/utils";

interface PillarLine {
  key: "pronostics" | "quiz" | "babyfoot" | "animations";
  label: string;
  emoji: string;
  raw: number;
  weighted: number;
}

export function ScoreBreakdown({
  row,
  className,
}: {
  row: LeaderboardRow;
  className?: string;
}) {
  const pillars: PillarLine[] = [
    {
      key: "pronostics",
      label: "Pronostics",
      emoji: "🎯",
      raw: row.points_predictions + row.points_bonus,
      weighted: row.weighted.pronostics,
    },
    { key: "quiz", label: "Quiz", emoji: "🧠", raw: row.points_quiz, weighted: row.weighted.quiz },
    { key: "babyfoot", label: "Babyfoot", emoji: "⚽", raw: row.points_babyfoot, weighted: row.weighted.babyfoot },
    { key: "animations", label: "Animations", emoji: "🎉", raw: row.points_animations, weighted: row.weighted.animations },
  ];
  const total = row.total || 0;
  const top = pillars.reduce((a, b) => (b.weighted > a.weighted ? b : a), pillars[0]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-canal-gray-muted uppercase tracking-wider font-bold">
          Décomposition du score
        </span>
        <span className="text-canal-yellow font-black text-lg tabular-nums">{total} pts</span>
      </div>

      {total > 0 && (
        <p className="text-xs text-canal-gray-muted">
          Point fort :{" "}
          <span className="text-white font-bold">
            {top.emoji} {top.label}
          </span>
        </p>
      )}

      <div className="space-y-1.5">
        {pillars.map((p) => {
          const share = total > 0 ? Math.round((p.weighted / total) * 100) : 0;
          return (
            <div key={p.key} className="bg-canal-gray-mid rounded-lg px-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-bold">
                  {p.emoji} {p.label}
                  <span className="text-canal-gray-muted font-normal ml-1.5 text-xs">
                    pilier {weightPct(p.key)}%
                  </span>
                </span>
                <span className="tabular-nums">
                  <span className="text-canal-yellow font-black">{p.weighted}</span>
                  <span className="text-canal-gray-muted text-xs ml-1">
                    ({p.raw} brut · {share}% du total)
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-canal-gray-light/30 overflow-hidden">
                <div
                  className="h-full bg-canal-yellow rounded-full"
                  style={{ width: `${Math.min(100, share)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Votes = métrique sociale, JAMAIS dans le classement principal. */}
      <div className="flex items-center justify-between text-xs text-canal-gray-muted px-3 pt-1">
        <span>❤️ Votes reçus (social — prix du public, hors classement)</span>
        <span className="tabular-nums">{row.points_votes}</span>
      </div>
    </div>
  );
}
