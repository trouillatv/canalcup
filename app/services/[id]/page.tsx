import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Target, Sparkles, Building2 } from "lucide-react";
import { getServiceDetail } from "@/lib/data/users";

export const revalidate = 60;

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-canal-gray-light bg-canal-gray-mid px-3 py-3">
      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">{label}</p>
      <p className="mt-1 text-xl font-black text-white tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-canal-gray-muted">{sub}</p>}
    </div>
  );
}

export default async function ServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getServiceDetail(id);
  if (!detail) notFound();

  const initials = (detail.service.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <div className="px-4 py-4 space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
          <ArrowLeft size={15} /> Services
        </Link>
        <Link href="/leaderboard" className="inline-flex items-center gap-1.5 text-canal-yellow text-sm font-bold hover:underline">
          <Target size={14} /> Classement
        </Link>
      </div>

      <header className="canal-card border border-canal-yellow/25 bg-gradient-to-br from-canal-yellow/10 to-transparent">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-canal-yellow text-canal-black flex items-center justify-center font-black text-2xl shrink-0">
            {detail.service.emoji ?? initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black text-white truncate">{detail.service.name}</h1>
              {detail.rank === 1 && (
                <span className="rounded-full bg-canal-yellow text-canal-black px-2 py-0.5 text-[10px] font-black">
                  #1
                </span>
              )}
            </div>
            <p className="text-canal-gray-muted text-sm mt-1">
              {detail.members} participant{detail.members > 1 ? "s" : ""} · moyenne {detail.average} pts · total {detail.total} pts
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-canal-gray-muted">
              <Building2 size={13} className="text-canal-yellow" />
              <span>Rang {detail.rank || "—"} dans le classement Services</span>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Participants" value={detail.members} sub="hors admins" />
        <StatCard label="Moyenne" value={detail.average} sub="points par personne" />
        <StatCard label="Total" value={detail.total} sub="points cumulés" />
        <StatCard label="Rang" value={detail.rank || "—"} sub="classement services" />
      </div>

      <div className="canal-card">
        <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Users size={13} /> Participants
        </p>
        {detail.roster.length === 0 ? (
          <p className="text-sm text-canal-gray-muted italic">Aucun participant classé pour ce service.</p>
        ) : (
          <div className="space-y-2">
            {detail.roster.map((member) => (
              <div key={member.user_id} className="rounded-2xl bg-canal-gray-mid border border-canal-gray-light px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-black text-white truncate">{member.display_name ?? "Sans nom"}</p>
                    <p className="text-xs text-canal-gray-muted mt-0.5 truncate">
                      {member.team_name ?? "Sans binôme"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-canal-yellow font-black text-lg tabular-nums">{member.total}</p>
                    <p className="text-[10px] text-canal-gray-muted">pts</p>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-xl bg-canal-black/30 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Pronos</p>
                    <p className="text-white font-black tabular-nums">{member.pronos}</p>
                  </div>
                  <div className="rounded-xl bg-canal-black/30 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Quiz</p>
                    <p className="text-white font-black tabular-nums">{member.quiz}</p>
                  </div>
                  <div className="rounded-xl bg-canal-black/30 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Baby</p>
                    <p className="text-white font-black tabular-nums">{member.babyfoot}</p>
                  </div>
                  <div className="rounded-xl bg-canal-black/30 px-2 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Anim</p>
                    <p className="text-white font-black tabular-nums">{member.animations}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="canal-card border border-canal-gray-light">
        <div className="flex items-center gap-2 text-sm text-canal-gray-muted">
          <Sparkles size={14} className="text-canal-yellow" />
          <span>
            Les points visibles ici suivent le même calcul que le classement général binôme, avec les points individuels du service.
          </span>
        </div>
      </div>
    </div>
  );
}
