"use client";

// Panneau "Captain" affiché dans /profile aux créateurs d'équipes
// (commit C du pivot équipes) :
// - Mes équipes : nom, code d'invitation (copiable), lien partageable
//   /onboarding?invite=CODE (copiable), membres X/3, places restantes.
// - Demandes pending sur ces équipes : nom du demandeur + boutons
//   Approuver / Rejeter (POST /api/teams/requests/decide).
//
// Se cache complètement si l'user n'a pas créé d'équipe → /profile
// reste propre pour les simples membres.

import { useCallback, useEffect, useState } from "react";
import { Crown, Copy, Check, Users, UserCheck, UserX, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface MyTeam {
  id: string;
  name: string;
  slogan: string | null;
  invite_code: string | null;
  members: number;
  slots_left: number;
  full: boolean;
}
interface PendingRequest {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
  requester: { id: string; display_name: string | null; name: string | null } | null;
}

export function TeamCaptainPanel() {
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null); // request_id en cours
  const [copied, setCopied] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/teams/requests/mine", { credentials: "same-origin" });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        setErr(b?.error ?? `HTTP ${res.status}`);
      } else {
        const d = await res.json();
        setTeams(d.teams ?? []);
        setRequests(d.requests ?? []);
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
    } catch {
      // Fallback rare (HTTP, anciens navigateurs) — sélection manuelle
      console.warn("clipboard KO");
    }
  };

  const decide = async (req: PendingRequest, decision: "approve" | "reject") => {
    setBusy(req.id);
    setErr(null);
    try {
      const res = await fetch("/api/teams/requests/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ request_id: req.id, decision }),
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

  // Pas d'équipe créée → on cache la section entière.
  if (!loading && teams.length === 0) return null;

  return (
    <section className="canal-card space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Crown size={14} /> Captain — mes équipes
        </p>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-canal-gray-muted hover:text-white flex items-center gap-1 disabled:opacity-50"
          title="Rafraîchir"
        >
          <RefreshCw size={11} /> Actualiser
        </button>
      </div>

      {err && (
        <p className="text-red-400 text-xs">{err}</p>
      )}

      {loading && teams.length === 0 ? (
        <p className="text-canal-gray-muted text-sm italic">Chargement…</p>
      ) : (
        teams.map((t) => {
          const link =
            typeof window !== "undefined" && t.invite_code
              ? `${window.location.origin}/onboarding?invite=${t.invite_code}`
              : "";
          const reqs = requests.filter((r) => r.team_id === t.id);
          return (
            <div key={t.id} className="bg-canal-gray-mid rounded-xl p-3 space-y-3">
              {/* Titre + slots */}
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-white truncate">{t.name}</p>
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1",
                    t.full
                      ? "bg-canal-gray-light/30 text-canal-gray-muted"
                      : "bg-canal-yellow/15 text-canal-yellow"
                  )}
                >
                  <Users size={10} /> {t.members}/3
                </span>
              </div>

              {/* Code + lien (uniquement si pas full et code dispo) */}
              {t.invite_code ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 font-mono font-black text-canal-yellow text-lg tracking-widest text-center bg-canal-gray border border-canal-gray-light/40 rounded-lg py-2">
                      {t.invite_code}
                    </code>
                    <button
                      onClick={() => copy(t.invite_code!, `code-${t.id}`)}
                      className="px-3 py-2 rounded-lg bg-canal-gray border border-canal-gray-light text-canal-gray-muted hover:text-white text-xs font-bold flex items-center gap-1"
                    >
                      {copied === `code-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                      {copied === `code-${t.id}` ? "OK" : "Code"}
                    </button>
                    <button
                      onClick={() => copy(link, `link-${t.id}`)}
                      disabled={!link}
                      className="px-3 py-2 rounded-lg bg-canal-yellow/15 text-canal-yellow border border-canal-yellow/30 hover:bg-canal-yellow/25 text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      {copied === `link-${t.id}` ? <Check size={12} /> : <Copy size={12} />}
                      {copied === `link-${t.id}` ? "OK" : "Lien"}
                    </button>
                  </div>
                  {t.full ? (
                    <p className="text-[11px] text-canal-gray-muted">
                      Équipe complète — plus de demandes acceptables.
                    </p>
                  ) : (
                    <p className="text-[11px] text-canal-gray-muted">
                      Partage le code ou le lien à <b>{t.slots_left}</b> coéquipier{t.slots_left > 1 ? "s" : ""} max.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-canal-gray-muted italic">
                  Pas de code d&apos;invitation pour cette équipe (équipe historique).
                </p>
              )}

              {/* Demandes pending */}
              {reqs.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-canal-gray-light/30">
                  <p className="text-[11px] text-canal-yellow font-bold uppercase tracking-wider">
                    Demandes en attente ({reqs.length})
                  </p>
                  {reqs.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 bg-canal-gray rounded-lg px-3 py-2"
                    >
                      <p className="text-white text-sm font-bold truncate">
                        {r.requester?.display_name ?? r.requester?.name ?? "—"}
                      </p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => decide(r, "approve")}
                          disabled={busy === r.id || t.full}
                          title={t.full ? "Équipe complète" : "Approuver"}
                          className="p-1.5 bg-canal-green/15 text-canal-green rounded-lg hover:bg-canal-green/25 transition-colors disabled:opacity-40"
                        >
                          <UserCheck size={14} />
                        </button>
                        <button
                          onClick={() => decide(r, "reject")}
                          disabled={busy === r.id}
                          title="Rejeter"
                          className="p-1.5 bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light rounded-lg hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
