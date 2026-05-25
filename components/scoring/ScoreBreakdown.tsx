// Décomposition lisible du score d'une équipe. Pondération d'origine (pronos
// 35 / quiz 20 / baby 20 / anim 25 %). RÈGLE : le score d'ÉQUIPE = babyfoot +
// animations (pondérés). Pronostics et quiz sont INDIVIDUELS (affichés à titre
// indicatif, hors score d'équipe). Votes = social. Présentation pure.

import type { LeaderboardRow } from "@/lib/supabase/types";
import { weightPct } from "@/lib/scoring/config";
import { cn } from "@/lib/utils";

interface PillarLine {
  key: "babyfoot" | "animations";
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
  // Piliers qui comptent pour l'équipe (pondérés).
  const teamPillars: PillarLine[] = [
    { key: "babyfoot", label: "Babyfoot", emoji: "⚽", raw: row.points_babyfoot, weighted: row.weighted.babyfoot },
    { key: "animations", label: "Animations / défis RSE", emoji: "🎉", raw: row.points_animations, weighted: row.weighted.animations },
  ];
  const total = row.total || 0;
  const top = teamPillars.reduce((a, b) => (b.weighted > a.weighted ? b : a), teamPillars[0]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-canal-gray-muted uppercase tracking-wider font-bold">
          Score d&apos;équipe
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
        {teamPillars.map((p) => {
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

      {/* Pronostics + quiz = INDIVIDUELS, hors score d'équipe (indicatif). */}
      <div className="pt-1 space-y-1">
        <p className="text-[11px] text-canal-gray-muted uppercase tracking-wider font-bold">
          Individuel — hors score d&apos;équipe
        </p>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>🎯 Pronostics ({weightPct("pronostics")}%, cumul membres)</span>
          <span className="tabular-nums">{row.weighted.pronostics}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>🧠 Quiz ({weightPct("quiz")}%, cumul membres)</span>
          <span className="tabular-nums">{row.weighted.quiz}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>❤️ Votes reçus (social — prix du public)</span>
          <span className="tabular-nums">{row.points_votes}</span>
        </div>
      </div>
    </div>
  );
}
