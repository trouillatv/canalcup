import { getLeaderboard, getIndividualLeaderboard } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { computeMedals } from "@/lib/data/medals";
import { LeaderboardTabs } from "@/components/leaderboard/LeaderboardTabs";
import { weightPct } from "@/lib/scoring/config";
import { Trophy } from "lucide-react";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const [rows, medals, serviceRows, individualRows] = await Promise.all([
    getLeaderboard(),
    computeMedals(),
    getServiceLeaderboard(),
    getIndividualLeaderboard(),
  ]);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Classements</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Mis à jour après chaque match</p>
      </div>

      {/* Classements en onglets (binômes / individuel / pronos / quiz / services) */}
      <LeaderboardTabs teamRows={rows} individualRows={individualRows} serviceRows={serviceRows} />

      {/* Système de points + pondérations (référence, sous les onglets) */}
      <div className="canal-card">
        <p className="text-canal-yellow font-bold text-sm mb-1 flex items-center gap-2">
          <Trophy size={14} />Système de points
        </p>
        <p className="text-canal-gray-muted text-xs mb-3">
          Le classement d&apos;équipe ne compte que le <span className="text-white font-bold">babyfoot</span> et les{" "}
          <span className="text-white font-bold">animations</span> (pondérés). Pronostics et quiz sont individuels.
        </p>
        <div className="space-y-1.5 text-sm">
          {[
            { label: "Victoire babyfoot", pts: "+10 pts", tag: "équipe" },
            { label: "Animation / défi RSE", pts: "≥ 5 pts", tag: "équipe" },
            { label: "Pronostic correct (V/N/D)", pts: "+5 pts", tag: "perso" },
            { label: "Score exact", pts: "+10 pts", tag: "perso" },
            { label: "Quiz rapide (< 5s)", pts: "+5 pts", tag: "perso" },
            { label: "Quiz correct", pts: "+3 pts", tag: "perso" },
            { label: "Vote reçu sur Revivez", pts: "+1 pt", tag: "social" },
          ].map(({ label, pts, tag }) => (
            <div key={label} className="flex justify-between items-center gap-2">
              <span className="text-canal-gray-muted flex items-center gap-2">
                {label}
                <span className={`text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${
                  tag === "équipe" ? "bg-canal-yellow/20 text-canal-yellow" : "bg-canal-gray-mid text-canal-gray-muted"
                }`}>{tag}</span>
              </span>
              <span className="text-canal-yellow font-bold whitespace-nowrap">{pts}</span>
            </div>
          ))}
        </div>

        {/* Rappel des pondérations par épreuve */}
        <div className="mt-3 pt-3 border-t border-canal-gray-light">
          <p className="text-canal-gray-muted text-[11px] uppercase tracking-wider font-bold mb-2">
            Pondération des épreuves
          </p>
          <div className="grid grid-cols-2 gap-1.5 text-sm">
            {[
              { l: "🎯 Pronostics", p: `${weightPct("pronostics")}%` },
              { l: "🧠 Quiz", p: `${weightPct("quiz")}%` },
              { l: "⚽ Babyfoot", p: `${weightPct("babyfoot")}%` },
              { l: "🎉 Animations", p: `${weightPct("animations")}%` },
            ].map(({ l, p }) => (
              <div key={l} className="flex justify-between bg-canal-gray-mid rounded-lg px-2.5 py-1.5">
                <span className="text-canal-gray-muted">{l}</span>
                <span className="text-canal-yellow font-bold">{p}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-canal-gray-muted mt-2 italic">
            Pronos &amp; quiz : pondérés au classement individuel. Babyfoot &amp; animations : au classement par binôme.
          </p>
        </div>
      </div>

      {medals.length > 0 && (
        <div>
          <h2 className="canal-headline text-xl mb-1">Médailles Absurdes</h2>
          <p className="text-canal-gray-muted text-xs mb-4">Calculées depuis les pronostics sur matchs terminés</p>
          <div className="space-y-3">
            {medals.map((medal) => (
              <div key={medal.key} className="canal-card flex items-start gap-3">
                <span className="text-3xl shrink-0">{medal.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <p className="font-black text-sm text-white uppercase tracking-wide">{medal.label}</p>
                    <span className="text-canal-yellow font-bold text-xs">{medal.value}</span>
                  </div>
                  <p className="text-canal-gray-muted text-xs leading-snug">{medal.description}</p>
                  <p className="text-canal-yellow/70 font-bold text-xs mt-1">{medal.team_name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
