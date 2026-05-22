"use client";

// /admin/user-audit/[id] — vue détail d'un utilisateur (admin + super_admin).
// Lecture seule : timeline reconstituée, activités récentes, points par
// catégorie. RGPD : aucune donnée intrusive.

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Flag, HelpCircle, PartyPopper, Heart, Users2 } from "lucide-react";
import type { AuditDetail, OnboardingStatus } from "@/lib/data/audit";

const ONBOARDING_LABEL: Record<OnboardingStatus, string> = {
  ok: "Onboarding OK", incomplete: "Onboarding incomplet", waiting_team: "En attente d'équipe",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const TIMELINE_EMOJI: Record<string, string> = {
  account_created: "🎬", profile_completed: "✅", team_join_requested: "🎟️",
  team_join_approved: "🤝", prediction_submitted: "🎯", quiz_answered: "❓",
  challenge_joined: "🎉", challenge_approved: "🏅", vote_cast: "❤️", admin_action: "🛠️",
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="canal-card">
      <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
        {icon}{title}
      </p>
      {children}
    </div>
  );
}

export default function UserAuditDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const [d, setD] = useState<AuditDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/admin/user-audit/${id}`, { credentials: "same-origin" });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      if (res.ok) setD(await res.json());
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <div className="px-4 py-8 text-center text-canal-gray-muted">Chargement…</div>;
  if (notFound || !d) return (
    <div className="px-4 py-8 max-w-2xl mx-auto text-center text-canal-gray-muted">
      Utilisateur introuvable.
      <div className="mt-4"><Link href="/admin/user-audit" className="text-canal-yellow underline">← Retour à l&apos;audit</Link></div>
    </div>
  );

  const pts = d.points_by_category;
  const totalPts = pts.predictions + pts.bonus + pts.quiz + pts.animations;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <Link href="/admin/user-audit" className="inline-flex items-center gap-1.5 text-canal-gray-muted hover:text-white text-sm">
        <ArrowLeft size={15} /> Retour à l&apos;audit
      </Link>

      {/* En-tête profil */}
      <div className="canal-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-black text-white">{d.display_name ?? "Profil incomplet"}</h1>
            <p className="text-xs text-canal-gray-muted mt-0.5">{d.email}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-canal-gray-muted">
              {d.role && <span>{d.role}</span>}
              {d.service_name && <span>· {d.service_name}</span>}
              {d.team_name && <span>· {d.team_name}</span>}
              <span>· {ONBOARDING_LABEL[d.onboarding]}</span>
              {!d.is_active && <span className="text-red-400">· Désactivé</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 mt-1 text-[11px] text-canal-gray-muted">
              <span>Créé {fmt(d.account_created_at)}</span>
              <span>· Dernière connexion {fmt(d.last_login_at)}</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="font-black text-canal-yellow text-2xl tabular-nums">{totalPts}</p>
            <p className="text-[10px] text-canal-gray-muted">points</p>
          </div>
        </div>
      </div>

      {/* Points par catégorie */}
      <Section icon={<Flag size={12} />} title="Points par catégorie">
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { l: "Pronos", v: pts.predictions }, { l: "Bonus", v: pts.bonus },
            { l: "Quiz", v: pts.quiz }, { l: "Animations", v: pts.animations },
          ].map((c) => (
            <div key={c.l} className="bg-canal-gray-mid rounded-lg py-2">
              <p className="font-black text-white text-lg tabular-nums">{c.v}</p>
              <p className="text-[10px] text-canal-gray-muted">{c.l}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Timeline */}
      <Section icon={<Clock size={12} />} title="Timeline des actions">
        {d.timeline.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucune action enregistrée.</p>
        ) : (
          <div className="space-y-2">
            {d.timeline.map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="shrink-0">{TIMELINE_EMOJI[t.type] ?? "•"}</span>
                <span className="text-white flex-1 truncate">{t.label}</span>
                <span className="text-canal-gray-muted shrink-0">{fmt(t.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Pronostics récents */}
      <Section icon={<Flag size={12} />} title={`Pronostics récents (${d.recent_predictions.length})`}>
        {d.recent_predictions.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucun pronostic.</p>
        ) : (
          <div className="space-y-1.5">
            {d.recent_predictions.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="text-white flex-1 truncate">{p.label} <span className="text-canal-gray-muted">({p.score})</span></span>
                <span className="text-canal-yellow font-bold shrink-0">+{p.points}</span>
                <span className="text-canal-gray-muted shrink-0 w-20 text-right">{fmt(p.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Quiz récents */}
      <Section icon={<HelpCircle size={12} />} title={`Quiz récents (${d.recent_quiz.length})`}>
        {d.recent_quiz.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucune réponse quiz.</p>
        ) : (
          <div className="space-y-1.5">
            {d.recent_quiz.map((q) => (
              <div key={q.id} className="flex items-center gap-2 text-xs">
                <span className="shrink-0">{q.is_correct ? "✅" : "❌"}</span>
                <span className="text-white flex-1 truncate">{q.question}</span>
                <span className="text-canal-yellow font-bold shrink-0">+{q.points}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Animations */}
      <Section icon={<PartyPopper size={12} />} title={`Animations participées (${d.animations.length})`}>
        {d.animations.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucune participation.</p>
        ) : (
          <div className="space-y-1.5">
            {d.animations.map((a) => (
              <div key={a.entry_id} className="flex items-center gap-2 text-xs">
                <span className="text-white flex-1 truncate">{a.title}</span>
                <span className="text-canal-gray-muted shrink-0">{a.role === "author" ? "soumis" : "participant"}</span>
                {a.status && <span className="text-canal-gray-muted shrink-0">· {a.status}</span>}
                <span className="text-canal-gray-muted shrink-0 w-20 text-right">{fmt(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Votes */}
      <Section icon={<Heart size={12} />} title={`Votes faits (${d.votes.count})`}>
        {d.votes.recent.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucun vote.</p>
        ) : (
          <div className="space-y-1.5">
            {d.votes.recent.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-white flex-1 truncate">{v.target_type ?? "Vote"}</span>
                <span className="text-canal-gray-muted shrink-0">{fmt(v.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Demandes équipe */}
      <Section icon={<Users2 size={12} />} title={`Demandes d'équipe (${d.team_requests.length})`}>
        {d.team_requests.length === 0 ? (
          <p className="text-xs text-canal-gray-muted">Aucune demande.</p>
        ) : (
          <div className="space-y-1.5">
            {d.team_requests.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-white flex-1 truncate">{r.team_name ?? "Équipe"}</span>
                <span className={`shrink-0 ${r.status === "approved" ? "text-green-400" : r.status === "pending" ? "text-blue-400" : "text-canal-gray-muted"}`}>{r.status}</span>
                <span className="text-canal-gray-muted shrink-0 w-20 text-right">{fmt(r.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Logs admin (Phase 2) */}
      {!d.admin_logs_available && (
        <p className="text-[11px] text-canal-gray-muted italic px-1">
          Logs d&apos;action admin liés à cet utilisateur : non disponibles (table d&apos;audit
          dédiée prévue en Phase 2).
        </p>
      )}
    </div>
  );
}
