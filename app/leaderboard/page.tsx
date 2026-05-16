import { getLeaderboard } from "@/lib/data/teams";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";
import { Trophy } from "lucide-react";

export const revalidate = 60;

export default async function LeaderboardPage() {
  const rows = await getLeaderboard();
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
            <div key={row.team.id} className="flex flex-col items-center gap-1 w-24">
              <span className="text-sm font-bold text-white text-center leading-tight">{row.team.name}</span>
              <span className="text-canal-yellow font-black">{row.total}pts</span>
              <div className={`${heights[i]} w-full bg-canal-gray rounded-t-lg flex items-center justify-center border border-canal-gray-light`}>
                <span className="text-2xl">{labels[i]}</span>
              </div>
            </div>
          );
        })}
      </div>

      <LeaderboardTable rows={sorted} />

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
    </div>
  );
}
