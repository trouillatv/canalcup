"use client";

// /admin/user-audit — dashboard d'audit utilisateurs (admin + super_admin).
//
// RGPD : audit = sécurité + support + animation. Pas de surveillance RH :
// aucun temps passé, aucune productivité, aucun comportement intrusif. On
// affiche des compteurs d'activité et des dates utiles au pilotage de l'event.

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Users, CheckCircle2, UserMinus, Activity, Flag, AlertTriangle,
  Send, UserX, Eye, Filter, ChevronDown,
} from "lucide-react";
import type { UserRole } from "@/lib/supabase/types";
import type { AuditListResult, AuditUserRow, OnboardingStatus } from "@/lib/data/audit";

const ROLE_LABELS: Record<UserRole, string> = {
  user: "Utilisateur", event_admin: "Animateur", admin: "Admin", super_admin: "Super Admin",
};
const ONBOARDING_LABEL: Record<OnboardingStatus, string> = {
  ok: "OK", incomplete: "Incomplet", waiting_team: "Attente équipe",
};
const ONBOARDING_CLASS: Record<OnboardingStatus, string> = {
  ok: "bg-green-950/40 text-green-400",
  incomplete: "bg-orange-950/40 text-orange-400",
  waiting_team: "bg-blue-950/40 text-blue-400",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}
function fmtAgo(iso: string | null) {
  if (!iso) return "jamais";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "à l'instant";
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  return `il y a ${d}j`;
}

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-canal-gray-mid rounded-xl border border-canal-gray-light px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-canal-gray-muted text-[11px] uppercase tracking-wider font-bold">
        {icon}{label}
      </div>
      <p className={`font-black text-2xl tabular-nums mt-1 ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

type ActivityFilter = "all" | "24h" | "7d" | "inactive";

export default function UserAuditPage() {
  const [data, setData] = useState<AuditListResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [fService, setFService] = useState("all");
  const [fTeam, setFTeam] = useState("all");
  const [fRole, setFRole] = useState<UserRole | "all">("all");
  const [fActive, setFActive] = useState<"all" | "active" | "inactive">("all");
  const [fIncomplete, setFIncomplete] = useState(false);
  const [fActivity, setFActivity] = useState<ActivityFilter>("all");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/user-audit", { credentials: "same-origin" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleResend = async (email: string) => {
    setBusy(email + ":resend");
    await fetch("/api/admin/users/resend", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(null);
  };
  const handleDisable = async (email: string) => {
    if (!confirm(`Désactiver l'accès de ${email} ?`)) return;
    setBusy(email + ":disable");
    await fetch(`/api/admin/users/${encodeURIComponent(email)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: false }),
    });
    await fetchAll();
    setBusy(null);
  };

  const services = useMemo(() => {
    const set = new Map<string, string>();
    data?.users.forEach((u) => { if (u.service_name) set.set(u.service_name, u.service_name); });
    return [...set.keys()].sort();
  }, [data]);
  const teams = useMemo(() => {
    const set = new Set<string>();
    data?.users.forEach((u) => { if (u.team_name) set.add(u.team_name); });
    return [...set].sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    return data.users.filter((u) => {
      if (fService !== "all" && u.service_name !== fService) return false;
      if (fTeam !== "all" && u.team_name !== fTeam) return false;
      if (fRole !== "all" && u.role !== fRole) return false;
      if (fActive === "active" && !u.is_active) return false;
      if (fActive === "inactive" && u.is_active) return false;
      if (fIncomplete && u.profile_completed) return false;
      if (fActivity !== "all") {
        const iso = u.last_action_at && u.last_login_at
          ? (u.last_action_at > u.last_login_at ? u.last_action_at : u.last_login_at)
          : (u.last_action_at ?? u.last_login_at);
        const ms = iso ? now - new Date(iso).getTime() : Infinity;
        if (fActivity === "24h" && ms > 86_400_000) return false;
        if (fActivity === "7d" && ms > 7 * 86_400_000) return false;
        if (fActivity === "inactive" && ms <= 7 * 86_400_000) return false;
      }
      return true;
    });
  }, [data, fService, fTeam, fRole, fActive, fIncomplete, fActivity]);

  const s = data?.summary;

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="canal-headline text-2xl">Monitoring Users</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          Audit utilisateurs — sécurité, support et animation. Pas de surveillance RH.
        </p>
      </div>

      {/* Synthèse globale */}
      {s && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard icon={<Users size={11} />} label="Total" value={s.total_users} />
          <StatCard icon={<CheckCircle2 size={11} />} label="Profils OK" value={s.profiles_completed} accent="text-green-400" />
          <StatCard icon={<UserMinus size={11} />} label="Sans équipe" value={s.without_team} />
          <StatCard icon={<Activity size={11} />} label="Actifs 24h" value={s.active_24h} accent="text-canal-yellow" />
          <StatCard icon={<Activity size={11} />} label="Actifs 7j" value={s.active_7d} accent="text-canal-yellow" />
          <StatCard icon={<Flag size={11} />} label="Pronostics" value={s.total_predictions} />
          <StatCard icon={<Flag size={11} />} label="Animations" value={s.total_animations} />
          <StatCard icon={<AlertTriangle size={11} />} label="Bloqués onb." value={s.blocked_onboarding} accent="text-orange-400" />
        </div>
      )}

      {/* Top équipes actives */}
      {s && s.top_active_teams.length > 0 && (
        <div className="canal-card">
          <p className="text-canal-yellow font-bold text-xs uppercase tracking-wider mb-2">Top équipes actives (7j)</p>
          <div className="flex flex-wrap gap-2">
            {s.top_active_teams.map((t) => (
              <span key={t.team_id} className="text-xs bg-canal-gray-mid rounded-lg px-2.5 py-1 text-white">
                {t.name} <span className="text-canal-yellow font-bold">· {t.active_members}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-canal-gray-muted"><Filter size={12} /></span>
        <select value={fActive} onChange={(e) => setFActive(e.target.value as typeof fActive)} className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white">
          <option value="all">Tous</option><option value="active">Actifs</option><option value="inactive">Désactivés</option>
        </select>
        <select value={fRole} onChange={(e) => setFRole(e.target.value as UserRole | "all")} className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white">
          <option value="all">Tous rôles</option>
          {(["user", "event_admin", "admin", "super_admin"] as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        <select value={fService} onChange={(e) => setFService(e.target.value)} className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white">
          <option value="all">Tous services</option>
          {services.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={fTeam} onChange={(e) => setFTeam(e.target.value)} className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white">
          <option value="all">Toutes équipes</option>
          {teams.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={fActivity} onChange={(e) => setFActivity(e.target.value as ActivityFilter)} className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white">
          <option value="all">Activité : toutes</option>
          <option value="24h">Actif 24h</option>
          <option value="7d">Actif 7j</option>
          <option value="inactive">Inactif &gt; 7j</option>
        </select>
        <label className="flex items-center gap-1.5 text-xs text-canal-gray-muted cursor-pointer">
          <input type="checkbox" checked={fIncomplete} onChange={(e) => setFIncomplete(e.target.checked)} />
          Profil incomplet
        </label>
      </div>

      <p className="text-xs text-canal-gray-muted">{filtered.length} utilisateur(s)</p>

      {/* Liste */}
      <div className="space-y-2">
        {loading && <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement…</div>}
        {!loading && filtered.length === 0 && (
          <div className="canal-card text-center py-8 text-canal-gray-muted">Aucun utilisateur avec ces filtres.</div>
        )}
        {!loading && filtered.map((u) => (
          <AuditRow
            key={u.email}
            u={u}
            busy={busy}
            onResend={() => handleResend(u.email)}
            onDisable={() => handleDisable(u.email)}
          />
        ))}
      </div>

      <p className="text-[11px] text-canal-gray-muted pt-2">
        « Connexion » = dernière requête authentifiée vers l&apos;app (mise à jour 1×/jour
        via middleware). « Dernière action » = activité la plus récente
        (prono, quiz, animation, vote). L&apos;historique détaillé des connexions
        n&apos;est pas conservé (RGPD).
      </p>
    </div>
  );
}

function AuditRow({
  u, busy, onResend, onDisable,
}: {
  u: AuditUserRow;
  busy: string | null;
  onResend: () => void;
  onDisable: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`canal-card ${!u.is_active ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">
              {u.display_name ?? <span className="italic text-canal-gray-muted">Profil incomplet</span>}
            </span>
            <span className={`text-[11px] px-1.5 py-0.5 rounded ${ONBOARDING_CLASS[u.onboarding]}`}>
              {ONBOARDING_LABEL[u.onboarding]}{u.pending_team_name ? ` · ${u.pending_team_name}` : ""}
            </span>
            {!u.is_active && <span className="text-[11px] bg-red-950/40 text-red-400 px-1.5 py-0.5 rounded">Désactivé</span>}
          </div>
          <p className="text-xs text-canal-gray-muted mt-0.5">{u.email}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-canal-gray-muted">
            <span>{ROLE_LABELS[u.role]}</span>
            {u.service_name && <span>· {u.service_name}</span>}
            {u.team_name && <span>· {u.team_name}</span>}
            <span>· Créé {fmtDate(u.account_created_at)}</span>
            <span>· Connexion {fmtAgo(u.last_login_at)}</span>
            <span>· Action {fmtAgo(u.last_action_at)}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-black text-canal-yellow text-lg tabular-nums">{u.points_total}</p>
          <p className="text-[10px] text-canal-gray-muted">points</p>
        </div>
      </div>

      {/* Compteurs */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pt-2 border-t border-canal-gray-light text-[11px] text-canal-gray-muted">
        <span>🎯 {u.predictions} pronos</span>
        <span>❓ {u.quiz} quiz</span>
        <span>🎉 {u.animations} animations</span>
        <span>❤️ {u.votes} votes</span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-2">
        {u.user_id && (
          <Link
            href={`/admin/user-audit/${u.user_id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover transition-colors"
          >
            <Eye size={13} /> Détail
          </Link>
        )}
        {u.is_active && (
          <button onClick={onResend} disabled={busy === u.email + ":resend"} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-gray-mid text-canal-gray-muted hover:text-white transition-all border border-canal-gray-light">
            <Send size={13} /> {busy === u.email + ":resend" ? "Envoi…" : "Renvoyer lien"}
          </button>
        )}
        {u.is_active && (
          <button onClick={onDisable} disabled={busy === u.email + ":disable"} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-950/30 text-red-400 hover:bg-red-950/50 transition-all">
            <UserX size={13} /> {busy === u.email + ":disable" ? "…" : "Désactiver"}
          </button>
        )}
        {u.pending_team_name && (
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-gray-mid text-blue-400 hover:text-blue-300 transition-all border border-canal-gray-light">
            <ChevronDown size={13} /> Demande équipe
          </button>
        )}
      </div>

      {open && u.pending_team_name && (
        <div className="mt-2 bg-canal-gray-mid rounded-lg p-2 text-xs text-canal-gray-muted">
          En attente de validation pour rejoindre <span className="text-white font-bold">{u.pending_team_name}</span>.
        </div>
      )}
    </div>
  );
}
