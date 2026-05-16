"use client";

import { useState } from "react";
import { MOCK_MATCHES, MOCK_PREDICTION_TRENDS } from "@/lib/mock-data";
import { MatchCard } from "@/components/matches/MatchCard";
import type { PredictionResult } from "@/lib/supabase/types";

export default function MatchesPage() {
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({});

  const upcoming = MOCK_MATCHES.filter((m) => m.status === "upcoming");
  const live = MOCK_MATCHES.filter((m) => m.status === "live");
  const finished = MOCK_MATCHES.filter((m) => m.status === "finished");

  const handlePredict = (matchId: string, result: PredictionResult) => {
    setPredictions((prev) => ({ ...prev, [matchId]: result }));
  };

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Matchs & Pronostics</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Toutes les heures en heure Nouvelle-Calédonie
        </p>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="live-dot" /> En direct
          </h2>
          <div className="space-y-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} trend={MOCK_PREDICTION_TRENDS[m.id]} userPrediction={predictions[m.id]} onPredict={(r) => handlePredict(m.id, r)} />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
            ⚽ À venir — Pronostiquez !
          </h2>
          <div className="space-y-4">
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} trend={MOCK_PREDICTION_TRENDS[m.id]} userPrediction={predictions[m.id]} onPredict={(r) => handlePredict(m.id, r)} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">
            Terminés
          </h2>
          <div className="space-y-3">
            {finished.map((m) => (
              <MatchCard key={m.id} match={m} compact />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
