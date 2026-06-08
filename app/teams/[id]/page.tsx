// /teams/[id] — fiche sportive du binôme (page de JEU, pas un audit).
// Réutilise getTeamDashboard, ScoreBreakdown, PredictionHeatmap. Pas de
// données RH (ni email, ni dernière connexion).

import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTeamDashboard } from "@/lib/data/team-dashboard";
import { getTeamPredictionHeatmap } from "@/lib/data/player";
import { ScoreBreakdown } from "@/components/scoring/ScoreBreakdown";
import { PredictionHeatmap } from "@/components/shared/PredictionHeatmap";
import {
  ArrowLeft, Trophy, Grid3x3, Target, Brain, Gamepad2, PartyPopper,
  Users, Crown, Ticket, Calendar, Flame, Sparkles, Clock, UserPlus,
} from "lucide-react";

export const revalidate = 60;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function RankCard({ label, rank, outOf }: { label: string; rank: number | null; outOf: number }) {
  return (
    <div className="bg-canal-gray-mid rounded-xl border border-canal-gray-light px-2 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">{label}</p>
      <p className="font-black text-xl text-canal-yellow tabular-nums leading-tight mt-0.5">{rank ? `#${rank}` : "—"}</p>
      {rank && <p className="text-[9px] text-canal-gray-muted">/ {outOf}</p>}
    </div>
  );
}

function Stat({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div>
      <p className={`font-black text-xl tabular-nums ${accent ?? "text-white"}`}>{value}</p>
      <p className="text-[10px] text-canal-gray-muted">{label}</p>
    </div>
  );
}

export default async function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [d, heatRows, { data: auth }] = await Promise.all([
    getTeamDashboard(id),
    getTeamPredictionHeatmap(id),
    supabase.auth.getUser(),
  ]);
  if (!d) notFound();

  // Code d'invitation visible uniquement par le capitaine.
  let viewerId: string | null = null;
  if (auth?.user) {
    const { data: me } = await supabase.from("users").select("id").eq("auth_id", auth.user.id).maybeSingle();
    viewerId = me?.id ?? null;
  }
  const viewerIsCaptain = !!viewerId && d.team.createdByUserId === viewerId;
  const heatHasData = heatRows.some((r) => r.items.length > 0);
  const ps = d.predictionStats;

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto">
      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
          <ArrowLeft size={15} /> Classement
        </Link>
        <Link href="/matches" className="inline-flex items-center gap-1.5 text-canal-yellow text-sm font-bold hover:underline">
          <Target size={14} /> Matchs & pronos
        </Link>
      </div>

      {/* ─── En-tête équipe ─── */}
      <div className="canal-card border border-canal-yellow/30 bg-gradient-to-br from-canal-yellow/10 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-canal-yellow text-canal-black flex items-center justify-center font-black text-2xl shrink-0">
            {d.team.initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-white truncate">{d.team.name}</h1>
            {d.team.slogan && <p className="text-canal-gray-muted text-sm italic truncate">{d.team.slogan}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-canal-gray-muted">
              {d.team.captainName && <span className="inline-flex items-center gap-1"><Crown size={11} className="text-canal-yellow" />{d.team.captainName}</span>}
              <span className="inline-flex items-center gap-1"><Users size={11} />{d.team.memberCount}/{d.team.maxMembers}</span>
              <span>· créé {fmtDate(d.team.createdAt)}</span>
            </div>
          </div>
          {d.ranks.global && (
            <div className="text-right shrink-0">
              <p className="text-canal-yellow font-black text-2xl tabular-nums">#{d.ranks.global}</p>
              <p className="text-[10px] text-canal-gray-muted">au général</p>
            </div>
          )}
        </div>
        {d.team.pendingRequests.length > 0 && (
          <div className="mt-3 pt-3 border-t border-orange-500/20 flex items-center gap-2 text-xs">
            <Clock size={13} className="text-orange-400 shrink-0" />
            <span className="text-orange-400 font-bold">
              {d.team.pendingRequests.length} demande{d.team.pendingRequests.length > 1 ? "s" : ""} d&apos;adhésion en attente
            </span>
            {viewerIsCaptain && (
              <Link href="/profile" className="ml-auto text-canal-yellow underline underline-offset-2 font-bold shrink-0">
                Valider →
              </Link>
            )}
          </div>
        )}
        {viewerIsCaptain && d.team.inviteCode && (
          <div className="mt-3 pt-3 border-t border-canal-gray-light flex items-center gap-2 text-xs">
            <Ticket size={13} className="text-canal-yellow" />
            <span className="text-canal-gray-muted">Code d&apos;invitation :</span>
            <span className="font-mono font-bold text-white bg-canal-gray-mid rounded px-2 py-0.5">{d.team.inviteCode}</span>
          </div>
        )}
      </div>

      {/* ─── Profil de l'équipe ─── */}
      <div className="canal-card flex items-center gap-2 text-sm">
        <Sparkles size={15} className="text-canal-yellow shrink-0" />
        <span className="text-white font-bold">{d.forces.label}</span>
      </div>

      {/* ─── Rangs par épreuve ─── */}
      <div>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-1.5"><Trophy size={14} />Rangs</h2>
        <div className="grid grid-cols-5 gap-1.5">
          <RankCard label="Général" rank={d.ranks.global} outOf={d.ranks.outOf} />
          <RankCard label="Pronos" rank={d.ranks.pronos} outOf={d.ranks.outOf} />
          <RankCard label="Quiz" rank={d.ranks.quiz} outOf={d.ranks.outOf} />
          <RankCard label="Baby" rank={d.ranks.babyfoot} outOf={d.ranks.outOf} />
          <RankCard label="Anim" rank={d.ranks.animations} outOf={d.ranks.outOf} />
        </div>
      </div>

      {/* ─── Décomposition du score ─── */}
      {d.lbRow && (
        <div className="canal-card">
          <ScoreBreakdown row={d.lbRow} />
        </div>
      )}

      {/* ─── Heatmap pronostics équipe ─── */}
      {heatHasData && (
        <div className="canal-card">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Grid3x3 size={13} />Heatmap des pronostics
          </p>
          <PredictionHeatmap mode="team" rows={heatRows} compact />
        </div>
      )}

      {/* ─── Stats pronostics ─── */}
      <div className="canal-card space-y-3">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><Target size={13} />Pronostics</p>
        <div className="grid grid-cols-4 gap-2 text-center">
          <Stat value={ps.count} label="pronos" />
          <Stat value={`${ps.exactPct}%`} label="🎯 exacts" accent="text-canal-yellow" />
          <Stat value={`${ps.correctPct}%`} label="✅ bons" accent="text-green-400" />
          <Stat value={ps.bestStreak} label="série max" accent="text-orange-400" />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-canal-gray-muted pt-1 border-t border-canal-gray-light">
          {ps.mostReliable && <span>🛡️ Plus fiable : <span className="text-white font-bold">{ps.mostReliable.name}</span> ({ps.mostReliable.pct}%)</span>}
          {ps.mostAudacious && <span>🎲 Plus audacieux : <span className="text-white font-bold">{ps.mostAudacious.name}</span> ({ps.mostAudacious.avgGoals} buts/prono)</span>}
          {ps.bestStreakPlayer && <span><Flame size={11} className="inline text-orange-400" /> Série : <span className="text-white font-bold">{ps.bestStreakPlayer}</span></span>}
        </div>
      </div>

      {/* ─── Quiz ─── */}
      <div className="canal-card space-y-2">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><Brain size={13} />Quiz</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={d.quizStats.count} label="répondues" />
          <Stat value={`${d.quizStats.correctPct}%`} label="bonnes" accent="text-canal-yellow" />
          <Stat value={d.quizStats.fast} label="⚡ rapides" />
        </div>
        {d.quizStats.bestPlayer && (
          <p className="text-[11px] text-canal-gray-muted pt-1 border-t border-canal-gray-light">🧠 Meilleur au quiz : <span className="text-white font-bold">{d.quizStats.bestPlayer.name}</span> ({d.quizStats.bestPlayer.correct} bonnes)</p>
        )}
      </div>

      {/* ─── Babyfoot & Animations ─── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="canal-card space-y-1">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><Gamepad2 size={13} />Babyfoot</p>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-2xl text-white">{d.babyfootStats.wins}<span className="text-sm text-canal-gray-muted">V</span></span>
            <span className="text-canal-gray-muted text-sm">{d.babyfootStats.losses}D</span>
            <span className="text-canal-yellow text-sm font-bold ml-auto">{d.babyfootStats.ratioPct}%</span>
          </div>
          <p className="text-[10px] text-canal-gray-muted">{d.babyfootStats.played} matchs joués</p>
          <p className="text-[10px] text-canal-gray-muted">Prochain : {fmtDateTime(d.babyfootStats.next)}</p>
        </div>
        <div className="canal-card space-y-1">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5"><PartyPopper size={13} />Animations</p>
          <div className="flex items-baseline gap-2">
            <span className="font-black text-2xl text-white">{d.animationStats.participations}</span>
            <span className="text-canal-yellow text-sm font-bold ml-auto">{d.animationStats.points} pts</span>
          </div>
          <p className="text-[10px] text-canal-gray-muted">participations</p>
          {d.animationStats.lastValidated && <p className="text-[10px] text-canal-gray-muted truncate">Dernière : {d.animationStats.lastValidated}</p>}
        </div>
      </div>

      {/* ─── Membres (cliquables) ─── */}
      <div>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Users size={14} />Membres ({d.team.memberCount}/{d.team.maxMembers})
          {d.team.slotsLeft > 0 && (
            <span className="ml-auto text-[10px] font-bold text-canal-gray-muted normal-case">
              {d.team.slotsLeft} place{d.team.slotsLeft > 1 ? "s" : ""} libre{d.team.slotsLeft > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <div className="space-y-2">
          {d.team.members.map((m) => {
            const inner = (
              <>
                <div className="w-9 h-9 rounded-full bg-canal-gray-mid flex items-center justify-center shrink-0">
                  <span className="font-bold text-canal-yellow text-sm">{m.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{m.name}</p>
                  <p className="text-xs text-canal-gray-muted">{m.isAdmin ? "Organisateur" : m.isCaptain ? "Capitaine" : "Coéquipier"}</p>
                </div>
                {m.isCaptain && <Crown size={14} className="text-canal-yellow shrink-0" />}
              </>
            );
            return m.isAdmin ? (
              <div key={m.id} className="canal-card flex items-center gap-3 opacity-70">{inner}</div>
            ) : (
              <Link key={m.id} href={`/joueur/${m.id}`} className="canal-card flex items-center gap-3 hover:bg-canal-gray-mid transition-colors">{inner}</Link>
            );
          })}
        </div>
      </div>

      {/* ─── Demandes en attente ─── */}
      {d.team.pendingRequests.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-orange-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock size={14} /> En attente de validation ({d.team.pendingRequests.length})
          </h2>
          <div className="space-y-2">
            {d.team.pendingRequests.map((r) => (
              <div key={r.userId} className="canal-card flex items-center gap-3 border border-orange-500/20 bg-orange-950/10">
                <div className="w-9 h-9 rounded-full bg-orange-900/30 border border-orange-500/30 flex items-center justify-center shrink-0">
                  <UserPlus size={15} className="text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">{r.name}</p>
                  <p className="text-xs text-orange-400/70">Demande envoyée le {fmtDate(r.createdAt)}</p>
                </div>
                <span className="text-[10px] font-bold text-orange-400 bg-orange-900/30 border border-orange-500/30 px-2 py-1 rounded-full shrink-0">
                  En attente
                </span>
              </div>
            ))}
          </div>
          {viewerIsCaptain && (
            <p className="text-xs text-canal-gray-muted mt-2 flex items-center gap-1.5">
              <Sparkles size={11} className="text-canal-yellow" />
              Valide ou refuse depuis <Link href="/profile" className="text-canal-yellow underline">ton profil → Mes équipes</Link>.
            </p>
          )}
        </div>
      )}

      {/* ─── Activité récente ─── */}
      {d.recentActivity.length > 0 && (
        <div className="canal-card">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5"><Calendar size={13} />Activité récente</p>
          <div className="space-y-1.5">
            {d.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span>{a.emoji}</span>
                <span className="text-white flex-1 truncate">{a.label}</span>
                <span className="text-canal-gray-muted shrink-0">{fmtDate(a.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
