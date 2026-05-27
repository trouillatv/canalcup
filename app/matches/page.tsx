// Server Component : données récupérées côté serveur (un seul rendu, pas de
// flash mock ni de double fetch client). MatchCard reste un composant client
// pour la saisie interactive du pronostic.

import Link from "next/link";
import { MatchCard } from "@/components/matches/MatchCard";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";
import { createClient } from "@/lib/supabase/server";
import { isToday } from "@/lib/utils";
import { Star, Trophy } from "lucide-react";

// Données live + pronostics par utilisateur → toujours frais.
export const dynamic = "force-dynamic";

type SavedMap = Record<string, { score_a: number; score_b: number; points?: number }>;

async function getMyPredictions(): Promise<SavedMap> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data: profile } = await supabase
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .single();
    if (!profile) return {};

    const { data: preds } = await supabase
      .from("predictions")
      .select("match_id, predicted_score_a, predicted_score_b, points_awarded")
      .eq("user_id", profile.id);

    const map: SavedMap = {};
    for (const p of preds ?? []) {
      if (p.predicted_score_a == null || p.predicted_score_b == null) continue;
      map[p.match_id] = {
        score_a: p.predicted_score_a,
        score_b: p.predicted_score_b,
        points: p.points_awarded,
      };
    }
    return map;
  } catch {
    return {};
  }
}

export default async function MatchesPage() {
  const [matches, trends, myPredictions] = await Promise.all([
    getMatches(),
    getPredictionTrends(),
    getMyPredictions(),
  ]);

  // Les matchs DU JOUR (heure NC) sont remontés en haut, quel que soit leur
  // statut, et exclus des listes ci-dessous (sinon enterrés sous les 70+ matchs
  // à venir). En Coupe du Monde il y a ~1 match/jour : c'est le repère utile.
  const today = matches.filter((m) => isToday(m.starts_at));
  const rest = matches.filter((m) => !isToday(m.starts_at));
  const upcoming = rest.filter((m) => m.status === "upcoming");
  const live = rest.filter((m) => m.status === "live");
  const finished = rest.filter((m) => m.status === "finished");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 py-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="canal-headline text-2xl">Matchs & Pronostics</h1>
            <p className="text-canal-gray-muted text-sm mt-0.5">Heures en heure Nouvelle-Calédonie</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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

        {today.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3 flex items-center gap-2">
              <Star size={14} /> {today.length > 1 ? "Matchs du jour" : "Match du jour"}
            </h2>
            <div className="space-y-4">
              {today.map((m) => (
                <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={myPredictions[m.id]} />
              ))}
            </div>
          </section>
        )}

        {live.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="live-dot" /> En direct
            </h2>
            <div className="space-y-3">
              {live.map((m) => (
                <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={myPredictions[m.id]} />
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
                <MatchCard key={m.id} match={m} trend={trends[m.id]} savedPrediction={myPredictions[m.id]} />
              ))}
            </div>
          </section>
        )}

        {finished.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">Terminés</h2>
            <div className="space-y-3">
              {finished.map((m) => (
                <MatchCard key={m.id} match={m} savedPrediction={myPredictions[m.id]} compact />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
