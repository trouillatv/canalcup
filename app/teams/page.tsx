import { getTeams } from "@/lib/data/teams";
import { TeamCard } from "@/components/teams/TeamCard";

export const revalidate = 60;

export default async function TeamsPage() {
  // getTeams() renvoie déjà trié par score CALCULÉ (source unique) —
  // plus aucun tri sur teams.total_points (dette de seed).
  const sorted = await getTeams();

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Les Équipes</h1>
        <p className="text-canal-gray-muted text-sm mt-1">3 équipes. 1 seul gagnant. Beaucoup de drama.</p>
      </div>
      <div className="space-y-3">
        {sorted.map((team, i) => (
          <TeamCard key={team.id} team={team} rank={i + 1} showDetails />
        ))}
      </div>
      <div className="canal-card bg-canal-gray-mid text-center">
        <p className="text-canal-yellow font-black text-lg mb-1">🎯 Règle du vote</p>
        <p className="text-canal-gray-muted text-sm">
          Vous ne pouvez pas voter pour votre propre équipe. Mais vous pouvez voter contre elles avec style.
        </p>
      </div>
    </div>
  );
}
