import { MOCK_BABYFOOT, MOCK_TEAMS } from "@/lib/mock-data";
import { toNCDate, toNCTime } from "@/lib/utils";
import { Trophy, Clock, Swords } from "lucide-react";

function BabyFootMatchCard({ match }: { match: (typeof MOCK_BABYFOOT)[0] }) {
  const isFinished = match.status === "finished";
  const isUpcoming = match.status === "upcoming";

  return (
    <div className="canal-card">
      <div className="flex items-center gap-1 text-xs text-canal-gray-muted mb-3">
        <Clock size={12} />
        <span>{toNCDate(match.starts_at)} — {toNCTime(match.starts_at)}</span>
        {match.status === "live" && (
          <span className="flex items-center gap-1 text-red-400 font-bold ml-2">
            <span className="live-dot" /> LIVE
          </span>
        )}
        {isFinished && <span className="ml-2 text-canal-gray-muted">Terminé</span>}
        {isUpcoming && <span className="ml-2 text-canal-yellow">À venir</span>}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-canal-gray-mid flex items-center justify-center mb-1">
            <span className="font-black text-canal-yellow text-xl">{match.team_a?.name[0]}</span>
          </div>
          <span className="text-sm font-bold text-center leading-tight">{match.team_a?.name}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          {isFinished ? (
            <div className="flex gap-2 items-center">
              <span className="score-display text-3xl">{match.score_a}</span>
              <span className="text-canal-gray-muted">-</span>
              <span className="score-display text-3xl">{match.score_b}</span>
            </div>
          ) : (
            <Swords size={24} className="text-canal-yellow" />
          )}
          <span className="text-xs text-canal-gray-muted">Babyfoot</span>
        </div>

        <div className="flex-1 flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-canal-gray-mid flex items-center justify-center mb-1">
            <span className="font-black text-canal-yellow text-xl">{match.team_b?.name[0]}</span>
          </div>
          <span className="text-sm font-bold text-center leading-tight">{match.team_b?.name}</span>
        </div>
      </div>

      {match.highlight && (
        <p className="mt-3 text-xs text-canal-gray-muted italic border-t border-canal-gray-light pt-2">
          💬 {match.highlight}
        </p>
      )}
    </div>
  );
}

function BabyFootLeaderboard() {
  const stats = MOCK_TEAMS.map((team) => {
    const played = MOCK_BABYFOOT.filter(
      (m) => m.status === "finished" && (m.team_a_id === team.id || m.team_b_id === team.id)
    );
    const won = played.filter((m) => {
      if (m.team_a_id === team.id) return (m.score_a ?? 0) > (m.score_b ?? 0);
      return (m.score_b ?? 0) > (m.score_a ?? 0);
    });
    return { team, played: played.length, won: won.length, points: won.length * 3 };
  }).sort((a, b) => b.points - a.points);

  return (
    <div className="space-y-2">
      {stats.map((s, i) => (
        <div key={s.team.id} className="canal-card flex items-center gap-3">
          <span className="font-black text-canal-yellow w-6 text-center">
            {i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉"}
          </span>
          <div className="flex-1">
            <p className="font-bold text-white text-sm">{s.team.name}</p>
            <p className="text-xs text-canal-gray-muted">{s.played} joués · {s.won} victoires</p>
          </div>
          <span className="font-black text-canal-yellow">{s.points} pts</span>
        </div>
      ))}
    </div>
  );
}

export default function BabyFootPage() {
  const upcoming = MOCK_BABYFOOT.filter((m) => m.status === "upcoming");
  const finished = MOCK_BABYFOOT.filter((m) => m.status === "finished");

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Tournoi Babyfoot</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Le football parallèle. Moins de VAR, plus de chaos.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3 flex items-center gap-2">
          <Trophy size={14} /> Classement babyfoot
        </h2>
        <BabyFootLeaderboard />
      </section>

      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-3">
            ⏰ Prochains matchs
          </h2>
          <div className="space-y-3">
            {upcoming.map((m) => (
              <BabyFootMatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider mb-3">
            Résultats
          </h2>
          <div className="space-y-3">
            {finished.map((m) => (
              <BabyFootMatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
