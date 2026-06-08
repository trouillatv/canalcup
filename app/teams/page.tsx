import Link from "next/link";
import { getTeams } from "@/lib/data/teams";
import { TeamCard } from "@/components/teams/TeamCard";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 60;

export default async function TeamsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [sorted, pendingRes, allPendingRes] = await Promise.all([
    getTeams(),
    user
      ? supabase.from("team_join_requests").select("team_id").eq("user_id", user.id).eq("status", "pending")
      : Promise.resolve({ data: [] }),
    supabase.from("team_join_requests").select("team_id").eq("status", "pending"),
  ]);

  const pendingTeamIds = new Set((pendingRes.data ?? []).map((r: { team_id: string }) => r.team_id));
  const pendingCountByTeam = (allPendingRes.data ?? []).reduce((acc: Record<string, number>, r: { team_id: string }) => {
    acc[r.team_id] = (acc[r.team_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Les Équipes</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {sorted.length > 0
            ? `${sorted.length} équipe${sorted.length > 1 ? "s" : ""}. 1 seul gagnant. Beaucoup de drama.`
            : "Les équipes se forment avant le coup d'envoi."}
        </p>
      </div>

      {sorted.length === 0 ? (
        <div className="canal-card text-center space-y-3 py-8">
          <p className="text-4xl">⚽</p>
          <p className="font-bold text-white text-base">Aucune équipe pour l&apos;instant</p>
          <p className="text-canal-gray-muted text-sm leading-relaxed">
            Les équipes sont créées par les participants. Va dans ton profil pour créer ou rejoindre une équipe.
          </p>
          <Link
            href="/profile"
            className="inline-block mt-2 px-5 py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl text-sm hover:bg-canal-yellow-hover transition-colors"
          >
            Mon profil → Mes équipes
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((team, i) => (
            <TeamCard key={team.id} team={team} rank={i + 1} showDetails hasPendingRequest={pendingTeamIds.has(team.id)} pendingCount={pendingCountByTeam[team.id] ?? 0} />
          ))}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="canal-card bg-canal-gray-mid text-center">
          <p className="text-canal-yellow font-black text-lg mb-1">🎯 Règle du vote</p>
          <p className="text-canal-gray-muted text-sm">
            Vous ne pouvez pas voter pour votre propre équipe. Mais vous pouvez voter contre elles avec style.
          </p>
        </div>
      )}
    </div>
  );
}
