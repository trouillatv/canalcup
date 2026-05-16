"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { AdminUserView, UserRole, Service } from "@/lib/supabase/types";
import { Shield, UserCheck, UserX, Send, ChevronDown, Plus, Filter } from "lucide-react";

const ROLE_LABELS: Record<UserRole, string> = {
  user: "Utilisateur",
  event_admin: "Animateur",
  admin: "Admin",
  super_admin: "Super Admin",
};
const ROLE_COLORS: Record<UserRole, string> = {
  user: "text-canal-gray-muted",
  event_admin: "text-blue-400",
  admin: "text-canal-yellow",
  super_admin: "text-purple-400",
};
const ALL_ROLES: UserRole[] = ["user", "event_admin", "admin", "super_admin"];

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function UserRow({
  u,
  services,
  onUpdate,
}: {
  u: AdminUserView;
  services: Service[];
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [resendLink, setResendLink] = useState<string | null>(null);
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const [showServiceMenu, setShowServiceMenu] = useState(false);

  const patch = async (body: Record<string, unknown>, actionKey: string) => {
    setLoading(actionKey);
    await fetch(`/api/admin/users/${encodeURIComponent(u.email)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setLoading(null);
    onUpdate();
  };

  const handleResend = async () => {
    setLoading("resend");
    const res = await fetch("/api/admin/users/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: u.email }),
    });
    const data = await res.json();
    if (data.link) setResendLink(data.link);
    setLoading(null);
  };

  return (
    <div className={cn(
      "canal-card space-y-3 transition-opacity",
      !u.is_active && "opacity-50"
    )}>
      {/* Ligne principale */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 font-black text-sm",
          u.is_active ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted"
        )}>
          {(u.display_name ?? u.email)[0].toUpperCase()}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white">
              {u.display_name ?? <span className="italic text-canal-gray-muted">Profil incomplet</span>}
            </span>
            <span className={cn("text-xs font-bold", ROLE_COLORS[u.role])}>
              {ROLE_LABELS[u.role]}
            </span>
            {!u.profile_completed && (
              <span className="text-xs bg-orange-950/40 text-orange-400 px-1.5 py-0.5 rounded">
                Onboarding
              </span>
            )}
            {!u.is_active && (
              <span className="text-xs bg-red-950/40 text-red-400 px-1.5 py-0.5 rounded">
                Désactivé
              </span>
            )}
          </div>
          <p className="text-xs text-canal-gray-muted mt-0.5">{u.email}</p>
          <div className="flex items-center gap-3 mt-1 text-xs text-canal-gray-muted">
            {u.service && (
              <span>{u.service.emoji} {u.service.name}</span>
            )}
            <span>Ajouté {formatDate(u.allowlist_created_at)}</span>
            <span>Connexion {formatDate(u.last_login_at ?? u.auth_last_sign_in)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-canal-gray-light">

        {/* Activer / Désactiver */}
        <button
          onClick={() => patch({ is_active: !u.is_active }, "toggle")}
          disabled={loading === "toggle"}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
            u.is_active
              ? "bg-red-950/30 text-red-400 hover:bg-red-950/50"
              : "bg-green-950/30 text-green-400 hover:bg-green-950/50"
          )}
        >
          {u.is_active ? <UserX size={13} /> : <UserCheck size={13} />}
          {loading === "toggle" ? "…" : u.is_active ? "Désactiver" : "Activer"}
        </button>

        {/* Changer rôle */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-gray-mid text-canal-gray-muted hover:text-white transition-all border border-canal-gray-light"
          >
            <Shield size={13} />
            Rôle
            <ChevronDown size={11} />
          </button>
          {showRoleMenu && (
            <div className="absolute left-0 top-8 z-20 bg-canal-gray border border-canal-gray-light rounded-xl shadow-xl min-w-36 overflow-hidden">
              {ALL_ROLES.map((r) => (
                <button
                  key={r}
                  onClick={() => { patch({ role: r }, "role"); setShowRoleMenu(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-bold hover:bg-canal-gray-mid transition-colors",
                    r === u.role ? "text-canal-yellow" : ROLE_COLORS[r]
                  )}
                >
                  {r === u.role ? "✓ " : ""}{ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Changer service */}
        <div className="relative">
          <button
            onClick={() => setShowServiceMenu(!showServiceMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-gray-mid text-canal-gray-muted hover:text-white transition-all border border-canal-gray-light"
          >
            Service
            <ChevronDown size={11} />
          </button>
          {showServiceMenu && (
            <div className="absolute left-0 top-8 z-20 bg-canal-gray border border-canal-gray-light rounded-xl shadow-xl min-w-40 overflow-hidden">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { patch({ service_id: s.id }, "service"); setShowServiceMenu(false); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-xs font-bold hover:bg-canal-gray-mid transition-colors",
                    s.id === u.service_id ? "text-canal-yellow" : "text-canal-gray-muted"
                  )}
                >
                  {s.id === u.service_id ? "✓ " : ""}{s.emoji} {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Renvoyer lien */}
        {u.is_active && (
          <button
            onClick={handleResend}
            disabled={loading === "resend"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-canal-gray-mid text-canal-gray-muted hover:text-white transition-all border border-canal-gray-light"
          >
            <Send size={13} />
            {loading === "resend" ? "Envoi…" : "Renvoyer lien"}
          </button>
        )}
      </div>

      {/* Lien magic (dev uniquement) */}
      {resendLink && (
        <div className="bg-canal-gray-mid rounded-lg p-2 mt-1">
          <p className="text-xs text-canal-gray-muted mb-1">Lien de connexion (dev) :</p>
          <a href={resendLink} className="text-xs text-canal-yellow break-all underline">
            {resendLink}
          </a>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserView[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<UserRole | "all">("all");
  const [filterService, setFilterService] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("user");
  const [inviting, setInviting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [usersRes, servicesRes] = await Promise.all([
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]);
    setUsers(usersRes);
    setServices(servicesRes);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = users.filter((u) => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (filterService !== "all" && u.service_id !== filterService) return false;
    if (filterActive === "active" && !u.is_active) return false;
    if (filterActive === "inactive" && u.is_active) return false;
    return true;
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setInviteEmail("");
    setShowInvite(false);
    setInviting(false);
    fetchAll();
  };

  const activeCount = users.filter((u) => u.is_active).length;
  const pendingCount = users.filter((u) => u.is_active && !u.profile_completed).length;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="canal-headline text-2xl">Gestion utilisateurs</h1>
        <div className="flex gap-4 mt-2 text-xs text-canal-gray-muted">
          <span>{users.length} au total</span>
          <span>{activeCount} actifs</span>
          {pendingCount > 0 && (
            <span className="text-orange-400">{pendingCount} en attente onboarding</span>
          )}
        </div>
      </div>

      {/* Inviter */}
      <div>
        <button
          onClick={() => setShowInvite(!showInvite)}
          className="flex items-center gap-2 px-4 py-2.5 bg-canal-yellow text-canal-black font-black rounded-xl text-sm hover:bg-canal-yellow-hover transition-colors"
        >
          <Plus size={16} />
          Ajouter un accès
        </button>

        {showInvite && (
          <form onSubmit={handleInvite} className="canal-card mt-3 space-y-3">
            <div>
              <label className="text-xs text-canal-gray-muted mb-1 block">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="prenom.nom@canal-plus.com"
                required
                className="w-full bg-canal-gray border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white placeholder:text-canal-gray-muted"
              />
            </div>
            <div>
              <label className="text-xs text-canal-gray-muted mb-1 block">Rôle</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as UserRole)}
                className="w-full bg-canal-gray border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white"
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="w-full py-2.5 bg-canal-yellow text-canal-black font-black rounded-lg text-sm disabled:opacity-50"
            >
              {inviting ? "Ajout…" : "Autoriser l'accès"}
            </button>
          </form>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1 text-xs text-canal-gray-muted">
          <Filter size={12} />
        </div>

        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value as typeof filterActive)}
          className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white"
        >
          <option value="all">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Désactivés</option>
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as UserRole | "all")}
          className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white"
        >
          <option value="all">Tous les rôles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>

        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1 text-xs text-white"
        >
          <option value="all">Tous les services</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>{s.emoji} {s.name}</option>
          ))}
        </select>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {loading && (
          <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="canal-card text-center py-8 text-canal-gray-muted">
            Aucun utilisateur avec ces filtres.
          </div>
        )}
        {!loading && filtered.map((u) => (
          <UserRow key={u.email} u={u} services={services} onUpdate={fetchAll} />
        ))}
      </div>
    </div>
  );
}
