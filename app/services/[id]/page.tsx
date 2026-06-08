import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Users, Target, Sparkles, Building2,
  Trophy, Brain, Gamepad2, PartyPopper, Crown, Flame,
} from "lucide-react";
import { getServiceDetail } from "@/lib/data/users";

export const revalidate = 60;

function RankCard({ label, rank, outOf }: { label: string; rank: number | null; outOf: number }) {
  return (
    <div className="bg-canal-gray-mid rounded-xl border border-canal-gray-light px-2 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">{label}</p>
      <p className="font-black text-xl text-canal-yellow tabular-nums leading-tight mt-0.5">
        {rank ? `#${rank}` : "—"}
      </p>
      {rank && <p className="text-[9px] text-canal-gray-muted">/ {outOf}</p>}
    </div>
  );
}

const LEVEL_LABEL: Record<string, string> = {
  expert: "Expert ⚽",
  amateur: "Amateur 🎯",
  ambiance: "Ambiance 🎉",
};

const LEVEL_COLOR: Record<string, string> = {
  expert: "text-canal-yellow",
  amateur: "text-green-400",
  ambiance: "text-fuchsia-400",
};

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getServiceDetail(id);
  if (!detail) notFound();

  const { service, roster, footballLevels, rank, outOf, members, average, total } = detail;

  const initials = (service.name ?? "?").slice(0, 2).toUpperCase();

  // Top performers
  const topTotal = roster[0] ?? null;
  const topPronos = [...roster].sort((a, b) => b.pronos - a.pronos)[0] ?? null;
  const topQuiz   = [...roster].sort((a, b) => b.quiz - a.quiz)[0] ?? null;

  // Répartition équipes
  const teamCounts = new Map<string, number>();
  for (const m of roster) {
    if (m.team_name) teamCounts.set(m.team_name, (teamCounts.get(m.team_name) ?? 0) + 1);
  }
  const topTeams = [...teamCounts.entries()].sort((a, b) => b[1] - a[1]);

  const totalLevels = footballLevels.expert + footballLevels.amateur + footballLevels.ambiance;
  const pct = (n: number) => totalLevels > 0 ? Math.round((n / totalLevels) * 100) : 0;

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto">

      {/* Nav */}
      <div className="flex items-center justify-between">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
          <ArrowLeft size={15} /> Services
        </Link>
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-canal-yellow text-sm font-bold hover:underline">
          <Target size={14} /> Classement
        </Link>
      </div>

      {/* ─── En-tête ─── */}
      <header className="canal-card border border-canal-yellow/25 bg-gradient-to-br from-canal-yellow/10 to-transparent">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-canal-yellow text-canal-black flex items-center justify-center font-black text-2xl shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white truncate">{service.name}</h1>
              {rank === 1 && (
                <span className="rounded-full bg-canal-yellow text-canal-black px-2 py-0.5 text-[10px] font-black">
                  #1
                </span>
              )}
            </div>
            <p className="text-canal-gray-muted text-sm mt-1">
              {members} participant{members !== 1 ? "s" : ""} · moyenne {average} pts · total {total} pts
            </p>
            <div className="flex items-center gap-2 text-xs text-canal-gray-muted mt-1.5">
              <Building2 size={12} className="text-canal-yellow" />
              <span>Rang {rank || "—"} / {outOf} services</span>
            </div>
          </div>
          {rank && (
            <div className="text-right shrink-0">
              <p className="text-canal-yellow font-black text-2xl tabular-nums">#{rank}</p>
              <p className="text-[10px] text-canal-gray-muted">au général</p>
            </div>
          )}
        </div>
      </header>

      {/* ─── Stats clés ─── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Participants", value: members, sub: "hors admins" },
          { label: "Moyenne", value: average, sub: "pts / personne" },
          { label: "Total", value: total, sub: "points cumulés" },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-canal-gray-mid rounded-xl border border-canal-gray-light px-3 py-3 text-center">
            <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">{label}</p>
            <p className="mt-1 text-xl font-black text-white tabular-nums">{value}</p>
            <p className="mt-0.5 text-[11px] text-canal-gray-muted">{sub}</p>
          </div>
        ))}
      </div>

      {/* ─── Rangs ─── */}
      {outOf > 1 && (
        <div>
          <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Trophy size={14} /> Rang dans les services
          </h2>
          <div className="grid grid-cols-1 gap-1.5">
            <RankCard label="Général (moyenne)" rank={rank} outOf={outOf} />
          </div>
        </div>
      )}

      {/* ─── Top performers ─── */}
      {roster.length > 0 && (
        <div className="canal-card space-y-2">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Flame size={13} /> Top performers
          </p>
          <div className="space-y-1.5 text-sm">
            {topTotal && (
              <div className="flex items-center gap-2">
                <Crown size={13} className="text-canal-yellow shrink-0" />
                <span className="text-canal-gray-muted">Meilleur score :</span>
                <Link href={`/joueur/${topTotal.user_id}`} className="text-white font-bold hover:text-canal-yellow transition-colors truncate">
                  {topTotal.display_name ?? "—"}
                </Link>
                <span className="ml-auto text-canal-yellow font-black tabular-nums shrink-0">{topTotal.total} pts</span>
              </div>
            )}
            {topPronos && topPronos.pronos > 0 && (
              <div className="flex items-center gap-2">
                <Target size={13} className="text-green-400 shrink-0" />
                <span className="text-canal-gray-muted">Meilleur prono :</span>
                <Link href={`/joueur/${topPronos.user_id}`} className="text-white font-bold hover:text-canal-yellow transition-colors truncate">
                  {topPronos.display_name ?? "—"}
                </Link>
                <span className="ml-auto text-green-400 font-black tabular-nums shrink-0">{topPronos.pronos} pts</span>
              </div>
            )}
            {topQuiz && topQuiz.quiz > 0 && (
              <div className="flex items-center gap-2">
                <Brain size={13} className="text-fuchsia-400 shrink-0" />
                <span className="text-canal-gray-muted">Meilleur quiz :</span>
                <Link href={`/joueur/${topQuiz.user_id}`} className="text-white font-bold hover:text-canal-yellow transition-colors truncate">
                  {topQuiz.display_name ?? "—"}
                </Link>
                <span className="ml-auto text-fuchsia-400 font-black tabular-nums shrink-0">{topQuiz.quiz} pts</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Roster ─── */}
      <div>
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Users size={14} /> Participants ({roster.length})
        </h2>
        {roster.length === 0 ? (
          <div className="canal-card text-center py-6">
            <p className="text-canal-gray-muted text-sm italic">Aucun participant classé pour ce service.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {roster.map((member) => (
              <Link
                key={member.user_id}
                href={`/joueur/${member.user_id}`}
                className="canal-card flex items-start gap-3 hover:bg-canal-gray-mid transition-colors group"
              >
                {/* Rang */}
                <div className="w-7 shrink-0 text-center text-sm font-black text-canal-gray-muted mt-0.5">
                  {member.rank === 1 ? "🥇" : member.rank === 2 ? "🥈" : member.rank === 3 ? "🥉" : `#${member.rank}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-white text-sm truncate group-hover:text-canal-yellow transition-colors">
                      {member.display_name ?? "Sans nom"}
                    </p>
                    {member.football_level && (
                      <span className={`text-[10px] font-bold ${LEVEL_COLOR[member.football_level] ?? "text-canal-gray-muted"}`}>
                        {LEVEL_LABEL[member.football_level] ?? member.football_level}
                      </span>
                    )}
                  </div>
                  {member.team_name && (
                    <p className="text-xs text-canal-gray-muted mt-0.5 truncate">{member.team_name}</p>
                  )}
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                    {[
                      { label: "Pronos", value: member.pronos },
                      { label: "Quiz", value: member.quiz },
                      { label: "Baby", value: member.babyfoot },
                      { label: "Anim", value: member.animations },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-canal-black/30 px-1.5 py-1.5">
                        <p className="text-[9px] uppercase tracking-wider text-canal-gray-muted font-bold">{label}</p>
                        <p className="text-white font-black tabular-nums text-sm">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-canal-yellow font-black text-lg tabular-nums">{member.total}</p>
                  <p className="text-[10px] text-canal-gray-muted">pts</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ─── Répartition niveau foot ─── */}
      {totalLevels > 0 && (
        <div className="canal-card space-y-3">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Gamepad2 size={13} /> Profil football
          </p>
          <div className="space-y-2">
            {[
              { key: "expert", color: "bg-canal-yellow" },
              { key: "amateur", color: "bg-green-500" },
              { key: "ambiance", color: "bg-fuchsia-500" },
            ].map(({ key, color }) => {
              const count = footballLevels[key as keyof typeof footballLevels];
              const p = pct(count);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={LEVEL_COLOR[key]}>{LEVEL_LABEL[key]}</span>
                    <span className="text-canal-gray-muted tabular-nums">{count} · {p}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-canal-gray-mid overflow-hidden">
                    <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${p}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Équipes représentées ─── */}
      {topTeams.length > 0 && (
        <div className="canal-card space-y-2">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <PartyPopper size={13} /> Équipes représentées
          </p>
          <div className="flex flex-wrap gap-2">
            {topTeams.map(([name, count]) => (
              <span
                key={name}
                className="rounded-full bg-canal-gray-mid border border-canal-gray-light px-3 py-1 text-xs text-white font-bold"
              >
                {name} <span className="text-canal-gray-muted font-normal">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ─── Note de calcul ─── */}
      <div className="canal-card border border-canal-gray-light">
        <div className="flex items-center gap-2 text-sm text-canal-gray-muted">
          <Sparkles size={14} className="text-canal-yellow" />
          <span>
            Le classement services compare les <span className="text-white">moyennes</span> (pas les totaux) pour ne pas pénaliser les petits services actifs.
          </span>
        </div>
      </div>

    </div>
  );
}
