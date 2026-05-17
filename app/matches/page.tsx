"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { MatchCard } from "@/components/matches/MatchCard";
import type { Match, PredictionTrend, Prediction } from "@/lib/supabase/types";
import { MOCK_MATCHES, MOCK_PREDICTION_TRENDS } from "@/lib/mock-data";
import { Star, Trophy } from "lucide-react";
import { BreakingNews } from "@/components/matches/BreakingNews";

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>(MOCK_MATCHES);
  const [trends, setTrends] = useState<Record<string, PredictionTrend>>(MOCK_PREDICTION_TRENDS);
  const [myPredictions, setMyPredictions] = useState<Record<string, Prediction>>({});

  useEffect(() => {
    fetch("/api/matches")
      .then((r) => r.json())
      .then((d) => {
        if (d.matches?.length) setMatches(d.matches);
        if (d.trends) setTrends(d.trends);
      })
      .catch(() => {});

    fetch("/api/predictions")
      .then((r) => r.json())
      .then((d) => {
        if (d.predictions) {
          const map: Record<string, Prediction> = {};
          for (const p of d.predictions) map[p.match_id] = p;
          setMyPredictions(map);
        }
      })
      .catch(() => {});
  }, []);

  const upcoming = matches.filter((m) => m.status === "upcoming");
  const live = matches.filter((m) => m.status === "live");
  const finished = matches.filter((m) => m.status === "finished");

  const toSavedPrediction = (matchId: string) => {
    const p = myPredictions[matchId];
    if (!p || p.predicted_score_a === undefined || p.predicted_score_b === undefined) return undefined;
    return { score_a: p.predicted_score_a!, score_b: p.predicted_score_b!, points: p.points_awarded };
  };

  return (
    <div className="max-w-2xl mx-auto">
      <BreakingNews />
    <div className="px-4 py-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="canal-headline text-2xl">Matchs & Pronostics</h1>
          <p className="text-canal-gray-muted text-sm mt-1">Heures en heure Nouvelle-Calédonie</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/bracket"
            className="flex items-center gap-1.5 text-xs font-bold text-white border border-canal-gray-light rounded-xl px-3 py-2 hover:bg-canal-gray-light/10 transition-colors"
          >
            <Trophy size={12} /> Tableau
          </Link>
          <Link
            href="/predictions"
            className="flex items-center gap-1.5 text-xs font-bold text-canal-yellow border border-canal-yellow/30 rounded-xl px-3 py-2 hover:bg-canal-yellow/10 transition-colors"
          >
            <Star size={12} /> Bonus
          </Link>
        </div>
      </div>

      {live.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="live-dot" /> En direct
          </h2>
          <div className="space-y-3">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={toSavedPrediction(m.id)} />
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
              <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={toSavedPrediction(m.id)} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">Terminés</h2>
          <div className="space-y-3">
            {finished.map((m) => (
              <MatchCard key={m.id} match={m} savedPrediction={toSavedPrediction(m.id)} compact />
            ))}
          </div>
        </section>
      )}
    </div>
    </div>
  );
}
