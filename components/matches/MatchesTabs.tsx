"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Match, PredictionTrend } from "@/lib/supabase/types";

interface SavedPrediction {
  score_a: number;
  score_b: number;
  points?: number;
}

interface MatchesTabsProps {
  upcoming: Match[];
  past: Match[];
  trends: Record<string, PredictionTrend>;
  saved: Record<string, SavedPrediction>;
}

type TabKey = "upcoming" | "past";

// Onglets "À venir" / "Passés" sous la section "Match du jour" de /matches.
// À venir : cartes complètes (saisie de prono). Passés : cartes compactes.
export function MatchesTabs({ upcoming, past, trends, saved }: MatchesTabsProps) {
  // On ouvre par défaut sur l'onglet qui a du contenu, en privilégiant "À venir"
  // (action principale = pronostiquer).
  const [tab, setTab] = useState<TabKey>(upcoming.length ? "upcoming" : "past");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "upcoming", label: "À venir", count: upcoming.length },
    { key: "past", label: "Passés", count: past.length },
  ];

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <section>
      <div className="flex border-b border-canal-gray-light mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 py-3 text-sm font-bold transition-colors uppercase tracking-wider",
              tab === t.key
                ? "text-canal-yellow border-b-2 border-canal-yellow"
                : "text-canal-gray-muted hover:text-white"
            )}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 text-canal-gray-muted font-normal">({t.count})</span>}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-center text-canal-gray-muted text-sm py-10">
          {tab === "upcoming" ? "Aucun match à venir." : "Aucun match passé."}
        </p>
      ) : (
        <div className={tab === "past" ? "space-y-3" : "space-y-4"}>
          {list.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              trend={trends[m.id]}
              savedPrediction={saved[m.id]}
              compact={tab === "past"}
            />
          ))}
        </div>
      )}
    </section>
  );
}
