"use client";

import { useState, useEffect } from "react";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Match, PredictionTrend, PredictionResult } from "@/lib/supabase/types";
import { MOCK_MATCHES, MOCK_PREDICTION_TRENDS } from "@/lib/mock-data";

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [trends, setTrends] = useState<Record<string, PredictionTrend>>(MOCK_PREDICTION_TRENDS);
  const [predictions, setPredictions] = useState<Record<string, PredictionResult>>({});

  useEffect(() => {
    fetch("/api/matches").then((r) => r.json()).then((d) => {
      if (d.matches?.length) setMatches(d.matches);
      if (d.trends) setTrends(d.trends);
    }).catch(() => {});
  }, []);

  const upcoming = matches.filter((m) => m.status === "upcoming");
  const live = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished");

  const handlePredict = (matchId: string, result: PredictionResult) => {
    setPredictions((prev) => ({ ...prev, [matchId]: result }));
    // TODO: POST /api/predictions avec user_id depuis la session
  };

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Matchs & Pronostics</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Toutes les heures en heure Nouvelle-Calédonie</p>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="live-dot" /> En direct
          </h2>
          <div className="space-y-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} trend={trends[m.id]} userPrediction={predictions[m.id]} onPredict={(r) => handlePredict(m.id, r)} />
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
              <MatchCard key={m.id} match={m} trend={trends[m.id]} userPrediction={predictions[m.id]} onPredict={(r) => handlePredict(m.id, r)} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">Terminés</h2>
          <div className="space-y-3">
            {finished.map((m) => <MatchCard key={m.id} match={m} compact />)}
          </div>
        </section>
      )}
    </div>
  );
}
