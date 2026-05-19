import Link from "next/link";
import { MapPin, Clock, Trophy, ChevronRight, Gamepad2 } from "lucide-react";
import { getChallenges } from "@/lib/data/challenges";
import { cn } from "@/lib/utils";
import type { Challenge, ChallengeStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_META: Record<ChallengeStatus, { label: string; cls: string; live?: boolean }> = {
  upcoming: { label: "À venir", cls: "text-canal-yellow bg-canal-yellow/10" },
  live: { label: "En cours", cls: "text-red-400 bg-red-900/20", live: true },
  finished: { label: "Terminé", cls: "text-canal-gray-muted bg-canal-gray-mid" },
  hidden: { label: "Masqué", cls: "text-canal-gray-muted bg-canal-gray-mid" },
};

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const meta = STATUS_META[challenge.status];
  return (
    <Link href={`/animations/${challenge.slug}`} className="block">
      <div className="canal-card hover:border-canal-yellow/40 transition-colors">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{challenge.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-white text-base leading-tight">{challenge.title}</h3>
              <span className={cn("shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1", meta.cls)}>
                {meta.live && <span className="live-dot" />}
                {meta.label}
              </span>
            </div>
            <p className="text-canal-gray-muted text-sm mt-1 line-clamp-2">{challenge.description}</p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-canal-gray-muted">
              {challenge.location && (
                <span className="flex items-center gap-1"><MapPin size={12} /> {challenge.location}</span>
              )}
              {challenge.duration_minutes != null && (
                <span className="flex items-center gap-1"><Clock size={12} /> {challenge.duration_minutes} min</span>
              )}
              <span className="flex items-center gap-1 text-canal-yellow font-bold">
                <Trophy size={12} /> {challenge.max_points > 0 ? `${challenge.max_points} pts max` : "Hors classement"}
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-canal-gray-muted shrink-0 self-center" />
        </div>
      </div>
    </Link>
  );
}

// Babyfoot = animation à part entière, mais feature dédiée avec son propre
// scoring (babyfoot_matches → leaderboard). On l'expose ici en simple carte
// vers /babyfoot — surtout PAS une ligne `challenges` (sinon double comptage
// via score_events). Lien sortant, zéro impact scoring.
function BabyfootCard() {
  return (
    <Link href="/babyfoot" className="block">
      <div className="canal-card hover:border-canal-yellow/40 transition-colors">
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">🎮</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-white text-base leading-tight">Tournoi Babyfoot</h3>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-canal-yellow bg-canal-yellow/10">
                Tournoi dédié
              </span>
            </div>
            <p className="text-canal-gray-muted text-sm mt-1 line-clamp-2">
              Le football parallèle de la Canal Cup. Moins de VAR, plus de chaos.
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-canal-gray-muted">
              <span className="flex items-center gap-1"><Gamepad2 size={12} /> Bracket & classement babyfoot</span>
              <span className="flex items-center gap-1 text-canal-yellow font-bold">
                <Trophy size={12} /> Compté au classement général
              </span>
            </div>
          </div>
          <ChevronRight size={18} className="text-canal-gray-muted shrink-0 self-center" />
        </div>
      </div>
    </Link>
  );
}

export default async function AnimationsPage() {
  const challenges = await getChallenges();
  const phase1 = challenges.filter((c) => c.phase === 1);
  const phase2 = challenges.filter((c) => c.phase !== 1);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Animations</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Les activités animées de la Canal Cup. Points attribués par l&apos;animateur.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
          🎬 Au programme
        </h2>
        <BabyfootCard />
        {phase1.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
      </section>

      {phase2.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider">
            🔜 Bientôt
          </h2>
          {phase2.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
        </section>
      )}

      {challenges.length === 0 && (
        <p className="text-canal-gray-muted text-sm text-center py-4">
          Les autres activités seront annoncées prochainement.
        </p>
      )}
    </div>
  );
}
