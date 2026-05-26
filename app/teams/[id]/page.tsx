import { notFound } from "next/navigation";
import Link from "next/link";
import { getTeamById, getLeaderboard } from "@/lib/data/teams";
import { pointsBadge } from "@/lib/utils";
import { ScoreBreakdown } from "@/components/scoring/ScoreBreakdown";
import { Users, Star, Trophy } from "lucide-react";

export const revalidate = 60;

const FOOTBALL_LEVEL_LABELS: Record<string, string> = {
  expert: "Expert ⚽",
  amateur: "Amateur 😊",
  ambiance: "Ambiance 🎉",
};

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [team, leaderboard] = await Promise.all([getTeamById(id), getLeaderboard()]);
  if (!team) notFound();

  const lbRow = leaderboard.find((r) => r.team.id === id);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div className="canal-card border border-canal-yellow/20">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-canal-gray-mid border-2 border-canal-yellow flex items-center justify-center">
            <span className="text-3xl font-black text-canal-yellow">{team.name[0]}</span>
          </div>
          <div className="flex-1">
            <h1 className="canal-headline text-xl">{team.name}</h1>
            <p className="text-canal-gray-muted text-sm italic mt-0.5">{team.slogan}</p>
            <p className="text-canal-yellow text-xs mt-1 font-bold">{team.reputation_label}</p>
          </div>
          <div className="text-right">
            <p className="text-canal-yellow font-black text-3xl">{team.total_points}</p>
            <p className="text-canal-gray-muted text-xs">points</p>
            <span className="text-2xl">{pointsBadge(team.total_points)}</span>
          </div>
        </div>
      </div>

      {lbRow && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
            <Trophy size={14} className="inline mr-1" />Décomposition des points
          </h2>
          <div className="canal-card">
            <ScoreBreakdown row={lbRow} />
          </div>
        </section>
      )}

      {team.members && team.members.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
            <Users size={14} className="inline mr-1" />Membres ({team.members.length})
          </h2>
          <div className="space-y-2">
            {team.members.map((member) => (
              <Link
                key={member.id}
                href={`/joueur/${member.id}`}
                className="canal-card flex items-center gap-3 hover:bg-canal-gray-mid transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-canal-gray-mid flex items-center justify-center">
                  <span className="font-bold text-canal-yellow text-sm">{(member.display_name ?? member.name)[0]}</span>
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white text-sm">{member.display_name ?? member.name}</p>
                  <p className="text-xs text-canal-gray-muted">{FOOTBALL_LEVEL_LABELS[member.football_level]}</p>
                </div>
                <Star size={14} className="text-canal-gray-muted" />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
