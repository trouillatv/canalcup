"use client";

// Phase C du pivot multi-team — panneau unique "Mes équipes Canal Cup"
// dans /profile. Remplace l'ancienne section "Mon équipe" + "Captain".
//
// Affiche : toutes les équipes du user, ⭐ pour la principale, badge
// rôle (captain/membre), nb membres X/3, code d'invitation + lien à
// copier (captains uniquement), demandes pending à approuver/rejeter
// (captains uniquement), boutons "Définir comme principale" et
// "Quitter" selon le contexte, + actions globales "Créer une autre"
// et "Rejoindre par code".

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Crown, Star, StarOff, Copy, Check, Users, UserCheck, UserX,
  RefreshCw, LogOut, Plus, Ticket, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TEAM_MAX_MEMBERS } from "@/lib/teams/config";

interface MyTeam {
  id: string;
  name: string;
  slogan: string | null;
  invite_code: string | null;
  role: "member" | "captain";
  is_primary: boolean;
  is_captain: boolean;
  members: number;
  slots_left: number;
  full: boolean;
  pending_requests: Array<{
    id: string;
    user_id: string;
    created_at: string;
    requester: { id: string; display_name: string | null; name: string | null } | null;
  }>;
}

export function MyTeamsPanel() {
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  // Onglet actif dans la box "Actions globales" en bas du panneau.
  // 'create' par défaut ; bascule à 'invite' s'il y a déjà une équipe
  // captain (cas le plus utile dans cet état).
  type Tab = "create" | "join" | "invite";
  const [tab, setTab] = useState<Tab>("create");

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/teams/membership/mine", { credentials: "same-origin" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `HTTP ${res.status}`);
      } else {
        const d = await res.json();
        setTeams(d.teams ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch { /* clipboard KO silencieux */ }
  };

  const callAction = async (url: string, body: object, busyKey: string) => {
    setBusy(busyKey);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `HTTP ${res.status}`);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setBusy(null);
    await refresh();
  };

  const setPrimary = (teamId: string) =>
    callAction("/api/teams/membership/set-primary", { team_id: teamId }, `prim-${teamId}`);
  const leave = (teamId: string) => {
    if (!confirm("Quitter cette équipe ? (irréversible — il faudra à nouveau le code d'invitation)")) return;
    return callAction("/api/teams/membership/leave", { team_id: teamId }, `leave-${teamId}`);
  };
  const decide = (reqId: string, decision: "approve" | "reject") =>
    callAction("/api/teams/requests/decide", { request_id: reqId, decision }, `decide-${reqId}`);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTeamName.trim();
    if (name.length < 2) return;
    setBusy("create");
    setErr(null);
    try {
      const res = await fetch("/api/teams/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `HTTP ${res.status}`);
      } else {
        setNewTeamName("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setBusy(null);
    await refresh();
  };

  const joinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setBusy("join");
    setErr(null);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ invite_code: joinCode.trim().toUpperCase() }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `HTTP ${res.status}`);
      } else {
        setJoinCode("");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setBusy(null);
    await refresh();
  };

  return (
    <section className="canal-card space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Users size={14} /> Mes équipes Canal Cup{teams.length > 0 && ` (${teams.length})`}
        </p>
        <button
          onClick={refresh}
          disabled={loading}
          title="Actualiser"
          className="text-xs text-canal-gray-muted hover:text-white flex items-center gap-1 disabled:opacity-50"
        >
          <RefreshCw size={11} /> Actualiser
        </button>
      </div>

      {err && (
        <p className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertCircle size={12} /> {err}
        </p>
      )}

      {loading && teams.length === 0 ? (
        <p className="text-canal-gray-muted text-sm italic">Chargement…</p>
      ) : teams.length === 0 ? (
        <p className="text-canal-gray-muted text-sm italic">
          Tu n&apos;es dans aucune équipe pour l&apos;instant. Crée ou rejoins-en une ci-dessous.
        </p>
      ) : (
        teams.map((t) => {
          const link =
            typeof window !== "undefined" && t.invite_code
              ? `${window.location.origin}/onboarding?invite=${t.invite_code}`
              : "";
          return (
            <div
              key={t.id}
              className={cn(
                "bg-canal-gray-mid rounded-xl p-3 space-y-2.5",
                t.is_primary && "ring-1 ring-canal-yellow/50"
              )}
            >
              {/* En-tête équipe */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 min-w-0">
                  {t.is_primary && (
                    <Star size={14} className="text-canal-yellow fill-canal-yellow shrink-0" />
                  )}
                  <Link
                    href={`/teams/${t.id}`}
                    className="font-bold text-white truncate hover:text-canal-yellow"
                  >
                    {t.name}
                  </Link>
                  {t.is_captain && (
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-canal-yellow text-canal-black flex items-center gap-1 shrink-0">
                      <Crown size={9} /> Captain
                    </span>
                  )}
                  {t.is_primary && (
                    <span className="text-[10px] font-bold uppercase text-canal-yellow shrink-0">
                      Principale
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1",
                    t.full
                      ? "bg-canal-gray-light/30 text-canal-gray-muted"
                      : "bg-canal-yellow/15 text-canal-yellow"
                  )}
                >
                  <Users size={10} /> {t.members}/{TEAM_MAX_MEMBERS}
                </span>
              </div>

              {/* Bloc captain : code + lien d'invitation */}
              {t.is_captain && t.invite_code && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-black text-canal-yellow text-base tracking-widest text-center bg-canal-gray border border-canal-gray-light/40 rounded-lg py-1.5">
                      {t.invite_code}
                    </code>
                    <button
                      onClick={() => copy(t.invite_code!, `code-${t.id}`)}
                      title="Copier le code"
                      className="px-2.5 py-1.5 rounded-lg bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30 hover:bg-canal-yellow/25 text-xs font-bold flex items-center gap-1 transition-colors"
                    >
                      {copied === `code-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                      {copied === `code-${t.id}` ? "OK" : "Code"}
                    </button>
                    <button
                      onClick={() => copy(link, `link-${t.id}`)}
                      disabled={!link}
                      title="Copier le lien d'invitation"
                      className="px-2.5 py-1.5 rounded-lg bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30 hover:bg-canal-yellow/25 text-xs font-bold flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      {copied === `link-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                      {copied === `link-${t.id}` ? "OK" : "Lien"}
                    </button>
                  </div>
                  {!t.full && (
                    <p className="text-[11px] text-canal-gray-muted">
                      Partage à <b>{t.slots_left}</b> coéquipier{t.slots_left > 1 ? "s" : ""} max.
                    </p>
                  )}
                </div>
              )}

              {/* Demandes pending — captain only */}
              {t.is_captain && t.pending_requests.length > 0 && (
                <div className="space-y-1 pt-1.5 border-t border-canal-gray-light/30">
                  <p className="text-[11px] text-canal-yellow font-bold uppercase tracking-wider">
                    Demandes en attente ({t.pending_requests.length})
                  </p>
                  {t.pending_requests.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 bg-canal-gray rounded-lg px-2.5 py-1.5"
                    >
                      <p className="text-white text-sm font-bold truncate">
                        {r.requester?.display_name ?? r.requester?.name ?? "—"}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => decide(r.id, "approve")}
                          disabled={busy === `decide-${r.id}` || t.full}
                          title={t.full ? "Équipe complète" : "Approuver"}
                          className="p-1.5 bg-canal-green/15 text-canal-green rounded-lg hover:bg-canal-green/25 transition-colors disabled:opacity-40"
                        >
                          <UserCheck size={13} />
                        </button>
                        <button
                          onClick={() => decide(r.id, "reject")}
                          disabled={busy === `decide-${r.id}`}
                          title="Rejeter"
                          className="p-1.5 bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light rounded-lg hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          <UserX size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions par équipe : set primary (si pas déjà) + leave (sauf captain) */}
              <div className="flex flex-wrap gap-2 pt-1.5">
                {!t.is_primary && (
                  <button
                    onClick={() => setPrimary(t.id)}
                    disabled={busy === `prim-${t.id}`}
                    className="text-xs font-bold text-canal-yellow border border-canal-yellow/30 bg-canal-yellow/10 rounded-lg px-2.5 py-1.5 flex items-center gap-1 hover:bg-canal-yellow/20 disabled:opacity-50"
                  >
                    <Star size={11} /> Définir principale
                  </button>
                )}
                {t.is_primary && teams.length > 1 && (
                  <span className="text-[11px] text-canal-gray-muted italic flex items-center gap-1">
                    <StarOff size={10} /> change la principale via une autre équipe
                  </span>
                )}
                {!t.is_captain && (
                  <button
                    onClick={() => leave(t.id)}
                    disabled={busy === `leave-${t.id}`}
                    className="text-xs font-bold text-canal-gray-muted border border-canal-gray-light bg-canal-gray rounded-lg px-2.5 py-1.5 flex items-center gap-1 hover:text-red-400 disabled:opacity-50"
                  >
                    <LogOut size={11} /> Quitter
                  </button>
                )}
                {t.is_captain && (
                  <span className="text-[11px] text-canal-gray-muted italic">
                    Captain — tu ne peux pas quitter (orphelinerait l&apos;équipe).
                  </span>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* Actions globales — 3 onglets dans la même box */}
      <div className="pt-2 border-t border-canal-gray-light/30 space-y-3">
        {/* Tab bar */}
        <div className="flex gap-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl p-1">
          <button
            type="button"
            onClick={() => { setTab("create"); setErr(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1",
              tab === "create" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            <Plus size={11} /> Créer
          </button>
          <button
            type="button"
            onClick={() => { setTab("join"); setErr(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1",
              tab === "join" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            <Ticket size={11} /> Rejoindre
          </button>
          <button
            type="button"
            onClick={() => { setTab("invite"); setErr(null); }}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1",
              tab === "invite" ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
            )}
          >
            <Copy size={11} /> Inviter
          </button>
        </div>

        {/* Tab content */}
        {tab === "create" && (
          <form onSubmit={createTeam} className="flex gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Nom de l&apos;équipe (ex : Les Frites)"
              maxLength={60}
              className="flex-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow"
            />
            <button
              type="submit"
              disabled={newTeamName.trim().length < 2 || busy === "create"}
              className="px-3 py-2 rounded-xl bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover text-xs font-black flex items-center gap-1 disabled:opacity-40 transition-colors"
            >
              <Plus size={12} /> {busy === "create" ? "…" : "Créer"}
            </button>
          </form>
        )}

        {tab === "join" && (
          <form onSubmit={joinByCode} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Code (ex : ABC123)"
              maxLength={12}
              className="flex-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 py-2 text-white placeholder:text-canal-gray-muted text-sm font-mono tracking-widest text-center uppercase focus:outline-none focus:border-canal-yellow"
            />
            <button
              type="submit"
              disabled={!joinCode.trim() || busy === "join"}
              className="px-3 py-2 rounded-xl bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover text-xs font-black flex items-center gap-1 disabled:opacity-40 transition-colors"
            >
              <Ticket size={12} /> Rejoindre
            </button>
          </form>
        )}

        {tab === "invite" && (() => {
          // Liste des équipes dont l'user est captain (les seules où le
          // code d'invitation est exposé). Sinon : pas d'invite possible.
          const captainTeams = teams.filter((t) => t.is_captain && t.invite_code);
          if (captainTeams.length === 0) {
            return (
              <p className="text-canal-gray-muted text-xs italic leading-snug">
                Tu n&apos;es captain d&apos;aucune équipe — seul le captain peut
                inviter. Crée une équipe dans l&apos;onglet <b>Créer</b> ou
                demande son code à un captain.
              </p>
            );
          }
          return (
            <div className="space-y-2">
              {captainTeams.map((t) => {
                const link =
                  typeof window !== "undefined" && t.invite_code
                    ? `${window.location.origin}/onboarding?invite=${t.invite_code}`
                    : "";
                const isFull = t.full;
                return (
                  <div key={`inv-${t.id}`} className="space-y-1">
                    <p className="text-[11px] text-canal-gray-muted">
                      <span className="text-white font-bold">{t.name}</span>{" "}
                      — {isFull ? "complète" : `${t.slots_left} place${t.slots_left > 1 ? "s" : ""} libre${t.slots_left > 1 ? "s" : ""}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 font-mono font-black text-canal-yellow text-base tracking-widest text-center bg-canal-gray-mid border border-canal-gray-light/40 rounded-lg py-1.5">
                        {t.invite_code}
                      </code>
                      <button
                        type="button"
                        onClick={() => copy(t.invite_code!, `tabcode-${t.id}`)}
                        title="Copier le code"
                        className="px-2.5 py-1.5 rounded-lg bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30 hover:bg-canal-yellow/25 text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        {copied === `tabcode-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                        {copied === `tabcode-${t.id}` ? "OK" : "Code"}
                      </button>
                      <button
                        type="button"
                        onClick={() => copy(link, `tablink-${t.id}`)}
                        disabled={!link}
                        title="Copier le lien d'invitation (ouvre l'onboarding pré-rempli)"
                        className="px-2.5 py-1.5 rounded-lg bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30 hover:bg-canal-yellow/25 text-xs font-bold flex items-center gap-1 disabled:opacity-50 transition-colors"
                      >
                        {copied === `tablink-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                        {copied === `tablink-${t.id}` ? "OK" : "Lien"}
                      </button>
                    </div>
                  </div>
                );
              })}
              <p className="text-[11px] text-canal-gray-muted italic leading-snug">
                Partage le code (qu&apos;il saisit côté Rejoindre) ou le lien
                (ouvre l&apos;onboarding pré-rempli). Tu valides ensuite sa
                demande depuis cette page.
              </p>
            </div>
          );
        })()}
      </div>
    </section>
  );
}
