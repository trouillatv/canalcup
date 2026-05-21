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
  RefreshCw, LogOut, Plus, Ticket, AlertCircle, Share2,
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

interface PendingOutgoing {
  id: string;
  team_id: string;
  team_name: string;
  created_at: string;
}

export function MyTeamsPanel() {
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [pendingOutgoing, setPendingOutgoing] = useState<PendingOutgoing[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  // Onglet actif dans la box du bas. L'onglet 'invite' a été retiré :
  // le partage est déjà dans la carte de chaque équipe (bouton Partager).
  type Tab = "create" | "join";
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
        setPendingOutgoing(d.pending_outgoing ?? []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // L'onglet 'create' n'a de sens que sans équipe. Si l'user a déjà une
  // équipe, on bascule auto sur 'join' (= changer d'équipe).
  useEffect(() => {
    if (teams.length > 0 && tab === "create") setTab("join");
  }, [teams.length, tab]);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch { /* clipboard KO silencieux */ }
  };

  // Partage natif (mobile) du lien d'invitation, fallback copie clipboard
  // (desktop). UNE action unique remplace les anciens doublons Code+Lien.
  const shareInvite = async (teamName: string, link: string, key: string) => {
    const text = `Rejoins mon équipe Canal Cup « ${teamName} » : ${link}`;
    const data: ShareData = {
      title: `Canal Cup — ${teamName}`,
      text: `Rejoins mon équipe Canal Cup « ${teamName} »`,
      url: link,
    };
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await navigator.share(data);
        return;
      }
    } catch {
      /* user a annulé → pas une erreur */
    }
    // Fallback : copier le lien complet.
    try {
      const c = typeof navigator !== "undefined" ? (navigator as Navigator).clipboard : undefined;
      if (c) {
        await c.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied((cc) => (cc === key ? null : cc)), 1800);
      }
    } catch { /* */ }
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
    setOkMsg(null);
    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ invite_code: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data?.error ?? `HTTP ${res.status}`);
      } else {
        setJoinCode("");
        const teamName = data?.team?.name ?? "l'équipe";
        setOkMsg(`✅ Demande envoyée à ${teamName}. Le captain doit la valider.`);
        // Le message disparaît après 8s pour ne pas polluer ad vitam.
        setTimeout(() => setOkMsg((cur) => (cur && cur.includes(teamName) ? null : cur)), 8000);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erreur réseau");
    }
    setBusy(null);
    await refresh();
  };

  const cancelRequest = async (requestId: string) => {
    if (!confirm("Annuler ta demande ?")) return;
    setBusy(`cancel-${requestId}`);
    setErr(null);
    try {
      const res = await fetch("/api/teams/requests/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ request_id: requestId }),
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

      {okMsg && (
        <p className="text-green-400 text-xs bg-green-950/20 border border-green-500/30 rounded-lg px-2.5 py-1.5">
          {okMsg}
        </p>
      )}

      {/* Demandes pending SORTANTES — équipes où j'attends une validation. */}
      {pendingOutgoing.length > 0 && (
        <div className="space-y-1.5">
          {pendingOutgoing.map((p) => (
            <div
              key={`outgoing-${p.id}`}
              className="bg-canal-yellow/5 border border-canal-yellow/30 rounded-xl px-3 py-2 flex items-center gap-2"
            >
              <span className="text-base">⏳</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">
                  Demande à {p.team_name}
                </p>
                <p className="text-[11px] text-canal-gray-muted">
                  En attente — le captain doit valider
                </p>
              </div>
              <button
                type="button"
                onClick={() => cancelRequest(p.id)}
                disabled={busy === `cancel-${p.id}`}
                className="text-xs font-bold text-canal-gray-muted hover:text-red-400 border border-canal-gray-light rounded-lg px-2 py-1 disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          ))}
        </div>
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

              {/* Bloc captain : code en grand (à dire à l'oral) +
                  UN seul bouton Partager (Web Share natif sur mobile,
                  copie clipboard sur desktop). Plus de doublon Code/Lien. */}
              {t.is_captain && t.invite_code && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-black text-canal-yellow text-base tracking-widest text-center bg-canal-gray border border-canal-gray-light/40 rounded-lg py-1.5">
                      {t.invite_code}
                    </code>
                    <button
                      onClick={() => shareInvite(t.name, link, `share-${t.id}`)}
                      disabled={!link}
                      title="Partager le lien d'invitation"
                      className="px-3 py-1.5 rounded-lg bg-canal-yellow text-canal-black hover:bg-canal-yellow-hover text-xs font-black flex items-center gap-1 disabled:opacity-50 transition-colors"
                    >
                      {copied === `share-${t.id}` ? <Check size={12} /> : <Share2 size={12} />}
                      {copied === `share-${t.id}` ? "Lien copié" : "Partager"}
                    </button>
                  </div>
                  {!t.full && (
                    <p className="text-[11px] text-canal-gray-muted">
                      Partage à <b>{t.slots_left}</b> coéquipier{t.slots_left > 1 ? "s" : ""} max.
                      Code à dire à l&apos;oral, ou clique Partager pour l&apos;envoyer par WhatsApp / SMS / Mail.
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

      {/* Actions globales — adaptées au mode BINÔME (un user = une équipe).
          - Sans équipe : tabs Créer / Rejoindre
          - Avec équipe : seul onglet 'Changer d'équipe' (input code).
          Le partage du code est dans la carte équipe au-dessus. */}
      <div className="pt-2 border-t border-canal-gray-light/30 space-y-3">
        {teams.length === 0 ? (
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
          </div>
        ) : (
          <p className="text-[11px] text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Ticket size={11} /> Changer d&apos;équipe
          </p>
        )}

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

        {(tab === "join" || teams.length > 0) && (
          <form onSubmit={joinByCode} className="space-y-1.5">
            <div className="flex gap-2">
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
                <Ticket size={12} /> {busy === "join" ? "…" : "Rejoindre"}
              </button>
            </div>
            {teams.length > 0 && (
              <p className="text-[10px] text-canal-gray-muted italic leading-snug">
                Saisis le code d&apos;une autre équipe. Une fois ta demande
                validée par son captain, tu quittes automatiquement ton
                équipe actuelle.
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
