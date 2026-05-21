// /animations — page joueur des animations/défis RSE.
// Vitrine de ce qui se passe pendant la Canal Cup : ce qui est EN COURS,
// ce qui ARRIVE bientôt, et ce qui est déjà TERMINÉ. Pour chaque défi :
// statut, lieu, durée, points max, solo/groupe, plancher de participation,
// et un chip "✓ tu as participé" si l'user a déjà une entry approuvée
// ou pending. Le détail (règles + résultats) reste sur /animations/[slug].

import Link from "next/link";
import {
  MapPin, Clock, Trophy, ChevronRight, Gamepad2, Users, User as UserIcon,
  Sparkles, CheckCircle2, Hourglass,
} from "lucide-react";
import { getChallenges } from "@/lib/data/challenges";
import { createClient } from "@/lib/supabase/server";
import { PARTICIPATION_MIN_POINTS } from "@/lib/scoring/config";
import { cn } from "@/lib/utils";
import type { Challenge, ChallengeStatus } from "@/lib/supabase/types";
import { NoTeamCTA } from "@/components/teams/NoTeamCTA";

export const dynamic = "force-dynamic";

const STATUS_META: Record<ChallengeStatus, { label: string; cls: string; live?: boolean }> = {
  upcoming: { label: "À venir", cls: "text-canal-yellow bg-canal-yellow/10" },
  live: { label: "En cours", cls: "text-red-400 bg-red-900/20", live: true },
  finished: { label: "Terminé", cls: "text-canal-gray-muted bg-canal-gray-mid" },
  hidden: { label: "Masqué", cls: "text-canal-gray-muted bg-canal-gray-mid" },
};

interface UserParticipation {
  status: "approved" | "pending" | "hidden";
}

function ChallengeCard({
  challenge,
  participation,
}: {
  challenge: Challenge;
  participation?: UserParticipation;
}) {
  const meta = STATUS_META[challenge.status];
  const isFinished = challenge.status === "finished";
  // Le plancher de participation s'applique aux défis non terminés.
  // (Il est capé par max_points : un challenge à 10 pts max ne donne pas
  // 5 pts si max_points est plus petit que le plancher.)
  const floor = challenge.max_points > 0
    ? Math.min(PARTICIPATION_MIN_POINTS, challenge.max_points)
    : PARTICIPATION_MIN_POINTS;
  const showFloor = !isFinished && floor > 0;
  const isGroup = !!challenge.allows_group;

  return (
    <Link href={`/animations/${challenge.slug}`} className="block">
      <div
        className={cn(
          "canal-card transition-colors",
          isFinished
            ? "opacity-70 hover:border-canal-gray-light"
            : "hover:border-canal-yellow/40"
        )}
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl shrink-0">{challenge.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-black text-white text-base leading-tight">{challenge.title}</h3>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex items-center gap-1",
                  meta.cls
                )}
              >
                {meta.live && <span className="live-dot" />}
                {meta.label}
              </span>
            </div>

            {/* Chip "tu as participé" si l'user est dans une entry pour ce défi */}
            {participation && (
              <p
                className={cn(
                  "mt-1.5 text-[11px] font-bold flex items-center gap-1",
                  participation.status === "approved"
                    ? "text-green-400"
                    : "text-canal-yellow"
                )}
              >
                {participation.status === "approved" ? (
                  <>
                    <CheckCircle2 size={12} /> Tu as participé · validée
                  </>
                ) : participation.status === "pending" ? (
                  <>
                    <Hourglass size={12} /> Ta participation est en attente de validation
                  </>
                ) : null}
              </p>
            )}

            <p className="text-canal-gray-muted text-sm mt-1 line-clamp-2">{challenge.description}</p>

            {/* Méta */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2.5 text-xs text-canal-gray-muted">
              {challenge.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {challenge.location}
                </span>
              )}
              {challenge.duration_minutes != null && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {challenge.duration_minutes} min
                </span>
              )}
              <span className="flex items-center gap-1 text-canal-yellow font-bold">
                <Trophy size={12} />
                {challenge.max_points > 0 ? `${challenge.max_points} pts max` : "Hors classement"}
              </span>
            </div>

            {/* Badges actionnables : solo/groupe + plancher */}
            {!isFinished && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1",
                    isGroup
                      ? "bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30"
                      : "bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light"
                  )}
                >
                  {isGroup ? <Users size={10} /> : <UserIcon size={10} />}
                  {isGroup ? "Groupe possible" : "Solo"}
                </span>
                {showFloor && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-green-900/30 text-green-400 border border-green-700/40 flex items-center gap-1">
                    <Sparkles size={10} /> ≥ {floor} pts garantis
                  </span>
                )}
              </div>
            )}
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
              <span className="flex items-center gap-1">
                <Gamepad2 size={12} /> Bracket & classement babyfoot
              </span>
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

  // Participations de l'user courant → pour chips "tu as participé".
  // Server-side, defensive (si Supabase blob, on tombe sur Map vide).
  const participatedByChallenge = new Map<string, UserParticipation>();
  try {
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: me } = await supabase
        .from("users")
        .select("id")
        .eq("auth_id", authUser.id)
        .maybeSingle();
      if (me) {
        const { data: rows } = await supabase
          .from("challenge_entry_participants")
          .select("entry:challenge_entries(challenge_id, status)")
          .eq("user_id", me.id);
        for (const r of rows ?? []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const e = (r as any).entry;
          if (!e?.challenge_id || !e?.status) continue;
          // Garde la meilleure (approved > pending > hidden).
          const prev = participatedByChallenge.get(e.challenge_id);
          const rank = (s: string) => (s === "approved" ? 3 : s === "pending" ? 2 : 1);
          if (!prev || rank(e.status) > rank(prev.status)) {
            participatedByChallenge.set(e.challenge_id, { status: e.status });
          }
        }
      }
    }
  } catch { /* silencieux : pas critique */ }

  // Tri par statut (LIVE en haut, puis upcoming, puis finished en bas).
  const live = challenges.filter((c) => c.status === "live");
  const upcoming = challenges.filter((c) => c.status === "upcoming");
  const finished = challenges.filter((c) => c.status === "finished");

  const renderCard = (c: Challenge) => (
    <ChallengeCard
      key={c.id}
      challenge={c}
      participation={participatedByChallenge.get(c.id)}
    />
  );

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      {/* Titre */}
      <div>
        <h1 className="canal-headline text-2xl">Animations</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Les activités RSE qui rythment la Canal Cup.
        </p>
      </div>

      {/* CTA si pas d'équipe — les points d'animation vont sur l'équipe. */}
      <NoTeamCTA action="participer à une animation" />

      {/* Bandeau pédagogique — pourquoi cette page sert */}
      <div className="canal-card border border-canal-yellow/30 bg-canal-yellow/5">
        <p className="text-canal-yellow font-bold text-sm flex items-center gap-1.5 mb-1.5">
          <Sparkles size={14} /> Comment ça marche
        </p>
        <ul className="text-xs text-canal-gray-muted space-y-1 leading-relaxed">
          <li>• Tape la carte d&apos;un défi pour voir les règles et où ça se passe.</li>
          <li>• Présente-toi à l&apos;animateur pour participer ; il valide ta participation.</li>
          <li>
            • Toute participation validée rapporte au moins{" "}
            <span className="text-green-400 font-bold">{PARTICIPATION_MIN_POINTS} pts</span>{" "}
            (capés par le max du défi). Les points vont à ton équipe Canal Cup.
          </li>
          <li>
            • Défi <span className="text-canal-yellow font-bold">Groupe</span> : tu peux participer
            avec d&apos;autres ; le total est divisé à parts égales entre les membres, chacun
            crédite son équipe.
          </li>
        </ul>
      </div>

      {/* EN COURS */}
      {live.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
            <span className="live-dot" /> En cours
          </h2>
          {live.map(renderCard)}
        </section>
      )}

      {/* À VENIR + Babyfoot (Babyfoot est un tournoi ongoing toute la CdM,
          on le met dans "à venir" pour qu'il soit toujours visible) */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">
          🎬 Au programme
        </h2>
        <BabyfootCard />
        {upcoming.length > 0 ? (
          upcoming.map(renderCard)
        ) : (
          challenges.length === 0 && (
            <p className="text-canal-gray-muted text-sm italic px-1">
              Les autres animations seront annoncées prochainement.
            </p>
          )
        )}
      </section>

      {/* TERMINÉ — replié visuellement (opacité réduite via la card) */}
      {finished.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-canal-gray-muted uppercase tracking-wider">
            ✅ Terminé
          </h2>
          {finished.map(renderCard)}
        </section>
      )}
    </div>
  );
}
