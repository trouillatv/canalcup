import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Trophy, ListChecks } from "lucide-react";
import { getChallengeBySlug } from "@/lib/data/challenges";
import { cn } from "@/lib/utils";
import type { ChallengeStatus } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const STATUS_META: Record<ChallengeStatus, { label: string; cls: string; live?: boolean }> = {
  upcoming: { label: "À venir", cls: "text-canal-yellow bg-canal-yellow/10" },
  live: { label: "En cours", cls: "text-red-400 bg-red-900/20", live: true },
  finished: { label: "Terminé", cls: "text-canal-gray-muted bg-canal-gray-mid" },
  hidden: { label: "Masqué", cls: "text-canal-gray-muted bg-canal-gray-mid" },
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  return { title: challenge ? `${challenge.title} — Canal Cup` : "Animation — Canal Cup" };
}

export default async function ChallengeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const challenge = await getChallengeBySlug(slug);
  if (!challenge) notFound();

  const meta = STATUS_META[challenge.status];
  const entries = challenge.entries ?? [];
  const ranked = [...entries]
    .filter((e) => e.status === "approved")
    .sort((a, b) => b.points_awarded - a.points_awarded);
  const pending = entries.filter((e) => e.status === "pending");

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <Link href="/animations" className="inline-flex items-center gap-1 text-sm text-canal-gray-muted hover:text-white">
        <ArrowLeft size={14} /> Toutes les animations
      </Link>

      {/* En-tête */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{challenge.emoji}</span>
          <div className="flex-1">
            <h1 className="canal-headline text-2xl leading-tight">{challenge.title}</h1>
            <span className={cn("inline-flex items-center gap-1 mt-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full", meta.cls)}>
              {meta.live && <span className="live-dot" />}
              {meta.label}
            </span>
          </div>
        </div>
        <p className="text-canal-gray-muted text-sm mt-3 leading-relaxed">{challenge.description}</p>
      </div>

      {/* Infos clés */}
      <div className="grid grid-cols-3 gap-3">
        <div className="canal-card flex flex-col items-center text-center gap-1 py-3">
          <MapPin size={16} className="text-canal-yellow" />
          <span className="text-xs text-canal-gray-muted">Lieu</span>
          <span className="text-sm font-bold text-white">{challenge.location ?? "—"}</span>
        </div>
        <div className="canal-card flex flex-col items-center text-center gap-1 py-3">
          <Clock size={16} className="text-canal-yellow" />
          <span className="text-xs text-canal-gray-muted">Durée</span>
          <span className="text-sm font-bold text-white">
            {challenge.duration_minutes != null ? `${challenge.duration_minutes} min` : "—"}
          </span>
        </div>
        <div className="canal-card flex flex-col items-center text-center gap-1 py-3">
          <Trophy size={16} className="text-canal-yellow" />
          <span className="text-xs text-canal-gray-muted">Points</span>
          <span className="text-sm font-bold text-white">
            {challenge.max_points > 0 ? `${challenge.max_points} max` : "0"}
          </span>
        </div>
      </div>

      {/* Règles / déroulé */}
      {challenge.rules && (
        <section>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-2">
            <ListChecks size={14} /> Règles & déroulé
          </h2>
          <div className="canal-card">
            <p className="text-sm text-canal-gray-muted leading-relaxed whitespace-pre-line">{challenge.rules}</p>
          </div>
        </section>
      )}

      {/* Résultats / équipes participantes */}
      <section>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-2">
          <Trophy size={14} /> Résultats
        </h2>
        {ranked.length === 0 && pending.length === 0 ? (
          <div className="canal-card">
            <p className="text-sm text-canal-gray-muted text-center py-4">
              Pas encore de participation. Les résultats s&apos;afficheront ici une fois l&apos;activité lancée.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.map((e, i) => (
              <div key={e.id} className="canal-card flex items-center gap-3 py-3">
                <span className="font-black text-canal-yellow w-7 text-center text-sm">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{e.team?.name ?? "Équipe"}</p>
                  {e.title && <p className="text-xs text-canal-gray-muted truncate">{e.title}</p>}
                </div>
                <span className="font-black text-canal-yellow text-sm shrink-0">{e.points_awarded} pts</span>
              </div>
            ))}
            {pending.map((e) => (
              <div key={e.id} className="canal-card flex items-center gap-3 py-3 opacity-70">
                <span className="w-7 text-center text-sm">⏳</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{e.team?.name ?? "Équipe"}</p>
                  {e.title && <p className="text-xs text-canal-gray-muted truncate">{e.title}</p>}
                </div>
                <span className="text-xs text-canal-gray-muted shrink-0">En attente</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
