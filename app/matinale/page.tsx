import { getTodayBrief } from "@/lib/data/content";
import { getMatches } from "@/lib/data/matches";
import { BriefCard } from "@/components/matinale/BriefCard";
import { TonightOnAir } from "@/components/matches/TonightOnAir";
import { toNCDate } from "@/lib/utils";
import { Newspaper } from "lucide-react";

export const revalidate = 300;

export default async function MatinalePage() {
  const [brief, matches] = await Promise.all([getTodayBrief(), getMatches()]);
  // Prochains matchs RÉELS : à venir ET dont le coup d'envoi n'est pas passé.
  // (sinon les vieux matchs du seed, statut "upcoming" mais date passée,
  // remontaient en tête → "matinale sur un très vieux match").
  const now = Date.now();
  const tonightMatches = matches
    .filter((m) => m.status === "upcoming" && new Date(m.starts_at).getTime() >= now)
    .slice(0, 3);

  if (!brief) {
    return (
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Newspaper size={16} className="text-canal-yellow" />
          <span className="canal-badge">Matinale quotidienne</span>
        </div>
        <h1 className="canal-headline text-2xl">La Matinale</h1>
        <div className="canal-card text-center py-10">
          <p className="text-canal-gray-muted text-sm">
            Pas encore de matinale aujourd&apos;hui — revenez après les résultats du soir.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Newspaper size={16} className="text-canal-yellow" />
          <span className="canal-badge">Matinale quotidienne</span>
        </div>
        <h1 className="canal-headline text-2xl">La Matinale</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {toNCDate(brief.date)} — Heure Nouvelle-Calédonie
        </p>
      </div>

      <BriefCard brief={brief} />

      {tonightMatches.length > 0 && (
        <TonightOnAir matches={tonightMatches} title="Ce soir — Ne ratez pas ça" />
      )}

      <div className="canal-card border-l-4 border-l-canal-yellow">
        <p className="text-xs text-canal-gray-muted font-bold uppercase tracking-wider mb-1">Classement du jour</p>
        <p className="text-white font-mono text-sm leading-relaxed">{brief.leaderboard_summary}</p>
      </div>

      <div className="canal-card text-center bg-canal-gray-mid">
        <p className="text-canal-gray-muted text-sm">
          Prochaine matinale demain matin — générée par le Coach IA après les résultats du soir
        </p>
      </div>
    </div>
  );
}
