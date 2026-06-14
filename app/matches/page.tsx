// Server Component : données récupérées côté serveur (un seul rendu, pas de
// flash mock ni de double fetch client). MatchCard reste un composant client
// pour la saisie interactive du pronostic.

import Link from "next/link";
import { MatchCard } from "@/components/matches/MatchCard";
import { MatchesTabs } from "@/components/matches/MatchesTabs";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";
import { createClient } from "@/lib/supabase/server";
import { isToday } from "@/lib/utils";
import { getUserTimezone } from "@/lib/auth/session";
import { Star, Trophy, Bell } from "lucide-react";
import { WC_START_MS } from "@/lib/tournament";

// Données live + pronostics par utilisateur → toujours frais.
export const dynamic = "force-dynamic";

type SavedMap = Record<string, { score_a: number; score_b: number; points?: number }>;

async function getMissingBonus(): Promise<{ missingWinner: boolean; missingTopScorer: boolean } | null> {
  // Pas de rappel si le tournoi a commencé
  if (Date.now() >= WC_START_MS) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("users").select("id").eq("auth_id", user.id).single();
    if (!profile) return null;
    const { data: bonuses } = await supabase
      .from("bonus_predictions")
      .select("prediction_type")
      .eq("user_id", profile.id)
      .in("prediction_type", ["winner", "top_scorer"]);
    const saved = new Set((bonuses ?? []).map((b: { prediction_type: string }) => b.prediction_type));
    const missingWinner = !saved.has("winner");
    const missingTopScorer = !saved.has("top_scorer");
    if (!missingWinner && !missingTopScorer) return null;
    return { missingWinner, missingTopScorer };
  } catch { return null; }
}

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
  const [matches, trends, myPredictions, tz, missingBonus] = await Promise.all([
    getMatches(),
    getPredictionTrends(),
    getMyPredictions(),
    getUserTimezone(),
    getMissingBonus(),
  ]);

  // Les matchs DU JOUR (heure NC) sont remontés en haut, quel que soit leur
  // statut, et exclus des onglets ci-dessous (sinon enterrés sous les 70+ matchs
  // à venir). En Coupe du Monde il y a ~1 match/jour : c'est le repère utile.
  const today = matches.filter((m) => isToday(m.starts_at, tz));
  const rest = matches.filter((m) => !isToday(m.starts_at, tz));
  // Onglet "À venir" : matchs à venir + un éventuel live (peu probable hors
  // aujourd'hui), du plus proche au plus lointain (matches déjà triés croissant).
  const upcoming = rest.filter((m) => m.status === "upcoming" || m.status === "live");
  // Onglet "Passés" : matchs terminés, du plus récent au plus ancien.
  const past = rest
    .filter((m) => m.status === "finished")
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

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
              <Star size={12} /> Mes pronos
            </Link>
          </div>
        </div>

        {missingBonus && (
          <Link
            href="/predictions"
            className="flex items-start gap-3 rounded-xl border border-canal-yellow/30 bg-canal-yellow/10 px-4 py-3 hover:bg-canal-yellow/15 transition-colors"
          >
            <Bell size={16} className="text-canal-yellow shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-canal-yellow">Pronostics bonus à remplir avant le tournoi !</p>
              <p className="text-xs text-canal-gray-muted mt-0.5">
                {[
                  missingBonus.missingWinner && "🏆 Vainqueur (+20 pts)",
                  missingBonus.missingTopScorer && "⚽ Meilleur buteur (+10 pts)",
                ].filter(Boolean).join(" · ")}
                {" — ferme le 11 juin"}
              </p>
            </div>
            <span className="text-canal-yellow text-xs font-bold shrink-0 mt-0.5">Remplir →</span>
          </Link>
        )}

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

        <MatchesTabs upcoming={upcoming} past={past} trends={trends} saved={myPredictions} />
      </div>
    </div>
  );
}
