import Link from "next/link";
import { getLeaderboard } from "@/lib/data/teams";
import { getServiceLeaderboard } from "@/lib/data/users";
import { computeMedals } from "@/lib/data/medals";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Trophy, Building2 } from "lucide-react";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const [rows, medals, serviceRows] = await Promise.all([
    getLeaderboard(),
    computeMedals(),
    getServiceLeaderboard(),
  ]);
  const sorted = [...rows].sort((a, b) => b.total - a.total);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Classement général</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Mis à jour après chaque match</p>
      </div>

      <div className="flex items-end justify-center gap-3 h-32">
        {[sorted[1], sorted[0], sorted[2]].map((row, i) => {
          if (!row) return <div key={i} className="w-24" />;
          const heights = ["h-20", "h-28", "h-16"];
          const labels = ["🥈", "🥇", "🥉"];
          return (
            <Link
              key={row.team.id}
              href={`/teams/${row.team.id}`}
              className="flex flex-col items-center gap-1 w-24 group"
            >
              <span className="text-sm font-bold text-white text-center leading-tight group-hover:text-canal-yellow transition-colors">{row.team.name}</span>
              <span className="text-canal-yellow font-black">{row.total}pts</span>
              <div className={`${heights[i]} w-full bg-canal-gray rounded-t-lg flex items-center justify-center border border-canal-gray-light group-hover:border-canal-yellow/50 transition-colors`}>
                <span className="text-2xl">{labels[i]}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <LeaderboardTable rows={sorted} />

      {serviceRows.length > 0 && (
        <div>
          <h2 className="canal-headline text-xl mb-1 flex items-center gap-2">
            <Building2 size={18} />Classement par service
          </h2>
          <p className="text-canal-gray-muted text-xs mb-4">
            Moyenne de points par personne — comparaison équitable entre services
            de tailles différentes
          </p>
          <div className="space-y-2">
            {serviceRows.map((row) => (
              <div
                key={row.service.id}
                className={`canal-card flex items-center ${
                  row.rank === 1 ? "border border-canal-yellow/30" : ""
                }`}
              >
                <div className="w-8 text-center font-black text-lg flex-shrink-0">
                  {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : row.rank}
                </div>
                <div className="flex-1 min-w-0 ml-1">
                  <p className="font-bold text-white truncate text-sm">{row.service.name}</p>
                  <p className="text-xs text-canal-gray-muted">
                    {row.members} pers. · {row.total} pts au total
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-canal-yellow text-lg tabular-nums">{row.average}</p>
                  <p className="text-[11px] text-canal-gray-muted">pts / pers.</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-canal-gray-muted px-1 pt-2">
            Basé sur les points individuels (pronostics, bonus, quiz, animations).
            Le babyfoot (score d&apos;équipe) et les votes ne sont pas comptés ici.
          </p>
        </div>
      )}

      <div className="canal-card">
        <p className="text-canal-yellow font-bold text-sm mb-3 flex items-center gap-2">
          <Trophy size={14} />Système de points
        </p>
        <div className="space-y-1.5 text-sm">
          {[
            { label: "Pronostic correct (victoire/nul)", pts: "+5 pts" },
            { label: "Score exact", pts: "+10 pts" },
            { label: "Quiz rapide (< 5s)", pts: "+5 pts" },
            { label: "Quiz correct", pts: "+3 pts" },
            { label: "Victoire babyfoot", pts: "+10 pts" },
            { label: "Vote reçu sur Revivez", pts: "+1 pt" },
          ].map(({ label, pts }) => (
            <div key={label} className="flex justify-between">
              <span className="text-canal-gray-muted">{label}</span>
              <span className="text-canal-yellow font-bold">{pts}</span>
            </div>
          ))}
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
