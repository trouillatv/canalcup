// /joueur/[id] — fiche joueur (page de JEU). Carte type Canal Cup : visuel,
// badges, barres. Visible par les participants connectés. Pas un audit RH :
// stats de jeu uniquement (ni email, ni temps passé, ni historique exhaustif).

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getPlayerDashboard, type PredStatus } from "@/lib/data/player";
import { getReputation } from "@/lib/data/reputation";
import { ReputationSection } from "@/components/reputation/ReputationSection";
import { PredictionHeatmap } from "@/components/shared/PredictionHeatmap";
import { ArrowLeft, Trophy, Users, Building2, Target, Brain, Gamepad2, PartyPopper, Flame, Grid3x3 } from "lucide-react";

export const dynamic = "force-dynamic";

const LEVEL_LABEL: Record<string, string> = {
  expert: "⚽ Expert", amateur: "📺 Amateur", ambiance: "🎉 Ambiance",
};
const PRED_BADGE: Record<PredStatus, { e: string; c: string }> = {
  exact: { e: "🎯", c: "text-canal-yellow" },
  correct: { e: "✅", c: "text-green-400" },
  missed: { e: "❌", c: "text-red-400" },
  pending: { e: "⏳", c: "text-canal-gray-muted" },
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function RankCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-canal-gray-mid rounded-xl border border-canal-gray-light px-3 py-3 text-center">
      <div className="flex items-center justify-center gap-1 text-canal-gray-muted text-[10px] uppercase tracking-wider font-bold">
        {icon}{label}
      </div>
      <p className="font-black text-2xl text-canal-yellow tabular-nums leading-tight mt-1">{value}</p>
      {sub && <p className="text-[10px] text-canal-gray-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function Bar({ icon, label, value, max, color = "bg-canal-yellow" }: { icon: React.ReactNode; label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-white font-bold flex items-center gap-1.5">{icon}{label}</span>
        <span className="text-canal-yellow font-black tabular-nums">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-canal-gray-light/30 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { id } = await params;
  const [d, reputation] = await Promise.all([getPlayerDashboard(id), getReputation(id)]);
  if (!d) notFound();

  const ps = d.predictionStats;
  const maxScore = Math.max(d.individualScore.pronos, d.individualScore.quiz, d.individualScore.babyfoot, d.individualScore.animations, 1);

  return (
    <div className="px-4 py-4 max-w-xl mx-auto space-y-5">
      <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
        <ArrowLeft size={15} /> Classement
      </Link>

      {/* ─── Carte joueur ─── */}
      <div className="canal-card border border-canal-yellow/30 bg-gradient-to-br from-canal-yellow/10 to-transparent">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-canal-yellow text-canal-black flex items-center justify-center font-black text-2xl shrink-0">
            {d.user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-white truncate">{d.user.display_name}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-canal-gray-muted">
              {d.user.football_level && (
                <span className="bg-canal-gray-mid rounded px-1.5 py-0.5">{LEVEL_LABEL[d.user.football_level] ?? d.user.football_level}</span>
              )}
              {d.user.service_name && <span>{d.user.service_name}</span>}
            </div>
            <div className="mt-1 text-xs text-canal-gray-muted">
              {d.user.team_name ? (
                <Link href={`/teams/${d.user.team_id}`} className="text-canal-yellow hover:underline inline-flex items-center gap-1">
                  <Users size={11} /> {d.user.team_name}
                </Link>
              ) : (
                <span>Sans binôme</span>
              )}
              <span> · arrivé le {fmt(d.user.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Les 3 rangs ─── */}
      <div className="grid grid-cols-3 gap-2">
        <RankCard
          icon={<Trophy size={11} />} label="Individuel"
          value={d.ranks.individual ? `#${d.ranks.individual.rank}` : "—"}
          sub={d.ranks.individual ? `/ ${d.ranks.individual.outOf} · ${d.ranks.individual.total} pts` : undefined}
        />
        <RankCard
          icon={<Users size={11} />} label="Binôme"
          value={d.ranks.team ? `#${d.ranks.team.rank}` : "—"}
          sub={d.ranks.team ? `/ ${d.ranks.team.outOf} · ${d.ranks.team.total} pts` : "sans équipe"}
        />
        <RankCard
          icon={<Building2 size={11} />} label="Service"
          value={d.ranks.service ? `#${d.ranks.service.rank}` : "—"}
          sub={d.ranks.service ? `/ ${d.ranks.service.outOf}` : "à venir"}
        />
      </div>

      {/* ─── Réputation : titre + badges ─── */}
      <ReputationSection reputation={reputation} />

      {/* ─── Score individuel détaillé ─── */}
      <div className="canal-card space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider">Score individuel</p>
          <span className="text-canal-yellow font-black text-xl tabular-nums">{d.individualScore.total} pts</span>
        </div>
        <Bar icon={<Target size={13} />} label="Pronostics" value={d.individualScore.pronos} max={maxScore} />
        <Bar icon={<Brain size={13} />} label="Quiz" value={d.individualScore.quiz} max={maxScore} />
        <Bar icon={<Gamepad2 size={13} />} label="Babyfoot (binôme)" value={d.individualScore.babyfoot} max={maxScore} color="bg-green-500" />
        <Bar icon={<PartyPopper size={13} />} label="Animations (binôme)" value={d.individualScore.animations} max={maxScore} color="bg-green-500" />
        <p className="text-[10px] text-canal-gray-muted italic">
          🎯 pronos &amp; 🧠 quiz = perso · ⚽ baby &amp; 🎉 anim = points du binôme (crédités aux 2).
        </p>
      </div>

      {/* ─── Stats pronostics ─── */}
      <div className="canal-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Target size={13} /> Pronostics
          </p>
          <span className="text-xs text-canal-gray-muted">{ps.finishedCount} pronos · {ps.pronoOnlyPoints} pts</span>
        </div>

        {ps.finishedCount > 0 ? (
          <>
            <div className="flex h-2.5 rounded-full overflow-hidden">
              <div className="bg-canal-yellow" style={{ width: `${ps.exactPct}%` }} />
              <div className="bg-green-500" style={{ width: `${ps.correctPct}%` }} />
              <div className="bg-red-500" style={{ width: `${ps.missedPct}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div><p className="font-black text-canal-yellow text-lg">{ps.exactPct}%</p><p className="text-[10px] text-canal-gray-muted">🎯 exacts ({ps.exact})</p></div>
              <div><p className="font-black text-green-400 text-lg">{ps.correctPct}%</p><p className="text-[10px] text-canal-gray-muted">✅ bons ({ps.correct})</p></div>
              <div><p className="font-black text-red-400 text-lg">{ps.missedPct}%</p><p className="text-[10px] text-canal-gray-muted">❌ ratés ({ps.missed})</p></div>
            </div>
          </>
        ) : (
          <p className="text-xs text-canal-gray-muted">Aucun match terminé pour l&apos;instant — les % arrivent après les premiers résultats.</p>
        )}

        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1 text-canal-gray-muted">
            <Flame size={12} className="text-orange-400" /> Meilleure série : <span className="text-white font-bold">{ps.bestStreak}</span>
          </span>
          <span className="text-canal-gray-muted">En cours : <span className="text-white font-bold">{ps.currentStreak}</span></span>
        </div>

        {ps.recent.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-canal-gray-light">
            {ps.recent.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span>{PRED_BADGE[r.status].e}</span>
                <span className="text-white flex-1 truncate">
                  {r.label} <span className="text-canal-gray-muted">({r.status === "pending" ? "prono saisi" : r.score})</span>
                </span>
                {r.points > 0 && <span className="text-canal-yellow font-bold">+{r.points}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Jokers (séparés des pronos) ─── */}
      <div className="canal-card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <span className="text-sm">🃏</span> Jokers
          </p>
          <span className="text-xs text-canal-gray-muted">
            {d.jokerStats.played} joué{d.jokerStats.played > 1 ? "s" : ""} ·{" "}
            <span className={d.jokerStats.points > 0 ? "text-green-400 font-bold" : d.jokerStats.points < 0 ? "text-red-400 font-bold" : "text-canal-gray-muted"}>
              {d.jokerStats.points > 0 ? "+" : ""}{d.jokerStats.points} pts
            </span>
          </span>
        </div>
        {d.jokerStats.played === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucun joker joué pour l&apos;instant.</p>
        ) : (
          <div className="space-y-1">
            {d.jokerStats.byType.map((j) => (
              <div key={j.type} className="flex items-center justify-between text-xs">
                <span className="text-white flex items-center gap-1.5">
                  <span className="text-sm">{j.emoji}</span> {j.name}
                  <span className="text-canal-gray-muted">×{j.count}</span>
                </span>
                {j.points !== 0 && (
                  <span className={j.points > 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                    {j.points > 0 ? "+" : ""}{j.points} pts
                  </span>
                )}
              </div>
            ))}
            <p className="text-[10px] text-canal-gray-muted italic pt-1 border-t border-canal-gray-light">
              🎰 Casino, 💥 Quitte ou Double &amp; 💣 Kamikaze rapportent des points perso (déjà inclus dans ton score). Les jokers offensifs n&apos;en rapportent pas.
            </p>
          </div>
        )}
      </div>

      {/* ─── Heatmap pronostics ─── */}
      {d.predictionHeatmap.length > 0 && (
        <div className="canal-card space-y-3">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Grid3x3 size={13} /> Heatmap des pronostics
          </p>
          <PredictionHeatmap mode="player" items={d.predictionHeatmap} />
        </div>
      )}

      {/* ─── Quiz ─── */}
      <div className="canal-card space-y-2">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
          <Brain size={13} /> Quiz
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div><p className="font-black text-white text-lg">{d.quizStats.count}</p><p className="text-[10px] text-canal-gray-muted">répondues</p></div>
          <div><p className="font-black text-canal-yellow text-lg">{d.quizStats.correctPct}%</p><p className="text-[10px] text-canal-gray-muted">bonnes ({d.quizStats.correct})</p></div>
          <div><p className="font-black text-white text-lg">{d.quizStats.fast}</p><p className="text-[10px] text-canal-gray-muted">⚡ rapides</p></div>
        </div>
        <p className="text-[10px] text-canal-gray-muted text-right">{d.quizStats.points} pts quiz</p>
      </div>

      {/* ─── Babyfoot & animations ─── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="canal-card text-center">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 mb-1">
            <Gamepad2 size={13} /> Babyfoot
          </p>
          {d.babyfootStats ? (
            <>
              <p className="font-black text-white text-2xl">{d.babyfootStats.wins}</p>
              <p className="text-[10px] text-canal-gray-muted">victoires de {d.babyfootStats.teamName}</p>
            </>
          ) : (
            <p className="text-xs text-canal-gray-muted py-2">Pas d&apos;équipe</p>
          )}
        </div>
        <div className="canal-card text-center">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 mb-1">
            <PartyPopper size={13} /> Animations
          </p>
          <p className="font-black text-white text-2xl">{d.animationStats.participations}</p>
          <p className="text-[10px] text-canal-gray-muted">participations · {d.animationStats.points} pts</p>
        </div>
      </div>

      {/* ─── Activité récente ─── */}
      <div className="canal-card">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-2">Activité récente</p>
        {d.recentActivity.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Rien encore. Que le jeu commence !</p>
        ) : (
          <div className="space-y-1.5">
            {d.recentActivity.map((a, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span>{a.emoji}</span>
                <span className="text-white flex-1 truncate">{a.label}</span>
                <span className="text-canal-gray-muted shrink-0">{fmt(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
