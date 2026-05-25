// Décomposition lisible du score d'une équipe. MODÈLE POINTS BRUTS (2026-05) :
// le score d'ÉQUIPE = babyfoot + animations/défis RSE, en points bruts. Les
// pronostics et le quiz sont PERSONNELS (affichés à titre indicatif, hors score
// d'équipe). Votes = social, hors classement. Présentation pure.

import type { LeaderboardRow } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

interface PillarLine {
  key: string;
  label: string;
  emoji: string;
  value: number;
}

export function ScoreBreakdown({
  row,
  className,
}: {
  row: LeaderboardRow;
  className?: string;
}) {
  // Piliers qui comptent pour l'équipe (points bruts).
  const teamPillars: PillarLine[] = [
    { key: "babyfoot", label: "Babyfoot", emoji: "⚽", value: row.points_babyfoot },
    { key: "animations", label: "Animations / défis RSE", emoji: "🎉", value: row.points_animations },
  ];
  const total = row.total || 0;
  const top = teamPillars.reduce((a, b) => (b.value > a.value ? b : a), teamPillars[0]);

  // Métriques personnelles (n'entrent PAS dans le score d'équipe).
  const persoPronos = row.points_predictions + row.points_bonus;
  const persoQuiz = row.points_quiz;

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
          const share = total > 0 ? Math.round((p.value / total) * 100) : 0;
          return (
            <div key={p.key} className="bg-canal-gray-mid rounded-lg px-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-bold">
                  {p.emoji} {p.label}
                </span>
                <span className="tabular-nums">
                  <span className="text-canal-yellow font-black">{p.value}</span>
                  <span className="text-canal-gray-muted text-xs ml-1">({share}% du total)</span>
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

      {/* Pronostics + quiz = PERSONNELS, hors score d'équipe (indicatif). */}
      <div className="pt-1 space-y-1">
        <p className="text-[11px] text-canal-gray-muted uppercase tracking-wider font-bold">
          Personnel — hors score d&apos;équipe
        </p>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>🎯 Pronostics (cumul des membres)</span>
          <span className="tabular-nums">{persoPronos}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>🧠 Quiz (cumul des membres)</span>
          <span className="tabular-nums">{persoQuiz}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-canal-gray-muted px-1">
          <span>❤️ Votes reçus (social — prix du public)</span>
          <span className="tabular-nums">{row.points_votes}</span>
        </div>
      </div>
    </div>
  );
}
