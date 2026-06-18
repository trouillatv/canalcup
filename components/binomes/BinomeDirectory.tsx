"use client";

// Annuaire "Trouver un binôme" (client). Filtres + recherche + groupement par
// service. PAS de points : on aide à former les équipes, pas à comparer les
// joueurs avant qu'ils aient joué.
//
// Parcours PRINCIPAL de lancement : "Demander en binôme" → proposer
// directement à une personne sans équipe de former une équipe Canal Cup. À
// l'acceptation, l'équipe est créée automatiquement avec les deux membres.
// Le code d'invitation reste un fallback (cf. /profile).

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Users, Plus, Ticket, Crown, UserPlus, Clock, Inbox, Send,
  Check, X, AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import type { BinomeEntry, BinomeServiceGroup } from "@/lib/data/binomes";
import type { SentPartnerRequest, ReceivedPartnerRequest } from "@/lib/data/binome-requests";
import type { FootballLevel } from "@/lib/supabase/types";

const LEVEL_META: Record<FootballLevel, { label: string; emoji: string }> = {
  expert: { label: "Expert", emoji: "⚽" },
  amateur: { label: "Amateur", emoji: "📺" },
  ambiance: { label: "Ambiance", emoji: "🎉" },
};

type Availability = "all" | "looking" | "in_team";

interface Props {
  entries: BinomeEntry[];
  services: BinomeServiceGroup[];
  myUserId: string | null;
  myTeamName: string | null;
  myInTeam: boolean;
  initialSent: SentPartnerRequest[];
  initialReceived: ReceivedPartnerRequest[];
}

export function BinomeDirectory({
  entries, services, myUserId, myTeamName, myInTeam,
  initialSent, initialReceived,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [serviceId, setServiceId] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [availability, setAvailability] = useState<Availability>("all");

  // Demandes binôme (envoyées / reçues) — initialisées côté serveur, puis
  // rafraîchies via l'API après chaque action.
  const [sent, setSent] = useState<SentPartnerRequest[]>(initialSent);
  const [received, setReceived] = useState<ReceivedPartnerRequest[]>(initialReceived);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Modale de confirmation "Demander en binôme".
  const [askTarget, setAskTarget] = useState<BinomeEntry | null>(null);
  const [teamNameInput, setTeamNameInput] = useState("");

  const svcName = useMemo(
    () => new Map(services.map((s) => [s.id, s.name])),
    [services]
  );

  const activeSent = sent.find((s) => s.status === "pending") ?? null;
  const lookingCount = entries.filter((e) => !e.team_id).length;

  const refreshRequests = useCallback(async () => {
    try {
      const res = await fetch("/api/binomes/requests", { credentials: "same-origin" });
      if (res.ok) {
        const d = await res.json();
        setSent(d.sent ?? []);
        setReceived(d.received ?? []);
      }
    } catch { /* silencieux */ }
    // Met aussi à jour l'annuaire serveur (statut équipe des cartes).
    router.refresh();
  }, [router]);

  const post = useCallback(
    async (url: string, body: object, busyKey: string): Promise<boolean> => {
      setBusy(busyKey);
      setErr(null);
      let ok = false;
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
        } else {
          ok = true;
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Erreur réseau");
      }
      setBusy(null);
      await refreshRequests();
      return ok;
    },
    [refreshRequests]
  );

  const submitAsk = async () => {
    if (!askTarget) return;
    const ok = await post(
      "/api/binomes/request",
      { target_user_id: askTarget.user_id, proposed_team_name: teamNameInput.trim() || undefined },
      `ask-${askTarget.user_id}`
    );
    if (ok) {
      setAskTarget(null);
      setTeamNameInput("");
    }
  };

  const cancelSent = (id: string) => post("/api/binomes/cancel", { request_id: id }, `cancel-${id}`);
  const respond = (id: string, decision: "accept" | "reject") =>
    post("/api/binomes/respond", { request_id: id, decision }, `resp-${id}`);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (
        q &&
        !e.display_name.toLowerCase().includes(q) &&
        !(e.full_name ?? "").toLowerCase().includes(q)
      )
        return false;
      if (serviceId !== "all" && e.service_id !== serviceId) return false;
      if (level !== "all" && e.football_level !== level) return false;
      if (availability === "looking" && e.team_id) return false;
      if (availability === "in_team" && !e.team_id) return false;
      return true;
    });
  }, [entries, query, serviceId, level, availability]);

  // Groupement par service. "Sans service" en dernier.
  const groups = useMemo(() => {
    const order = new Map(services.map((s, i) => [s.id, i]));
    const byService = new Map<string, BinomeEntry[]>();
    for (const e of filtered) {
      const key = e.service_id ?? "__none__";
      const arr = byService.get(key) ?? [];
      arr.push(e);
      byService.set(key, arr);
    }
    const keys = [...byService.keys()].sort((a, b) => {
      if (a === "__none__") return 1;
      if (b === "__none__") return -1;
      return (order.get(a) ?? 999) - (order.get(b) ?? 999);
    });
    return keys.map((k) => ({
      id: k,
      name: k === "__none__" ? "Sans service" : services.find((s) => s.id === k)?.name ?? "Service",
      people: byService.get(k)!,
    }));
  }, [filtered, services]);

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
      <header>
        <h1 className="canal-headline text-2xl">Trouver un binôme</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {lookingCount > 0
            ? `${lookingCount} participant${lookingCount > 1 ? "s" : ""} cherche${lookingCount > 1 ? "nt" : ""} encore un binôme.`
            : "Tout le monde a son binôme. 🎉"}
        </p>
      </header>

      {err && (
        <p className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertCircle size={12} /> {err}
        </p>
      )}

      {/* Demandes REÇUES — à traiter en priorité (accepter / refuser). */}
      {received.length > 0 && !myInTeam && (
        <section className="canal-card space-y-2 border border-canal-green/30 bg-canal-green/5">
          <h2 className="text-xs text-canal-green font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Inbox size={14} /> Demandes reçues ({received.length})
          </h2>
          {received.map((r) => {
            const lvl = r.requester_level ? LEVEL_META[r.requester_level] : null;
            const svc = r.requester_service ? svcName.get(r.requester_service) : null;
            return (
              <div
                key={r.id}
                className="bg-canal-gray-mid rounded-xl px-3 py-2.5 flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {r.requester_name}{" "}
                    <span className="font-normal text-canal-gray-muted">
                      te propose un binôme
                    </span>
                  </p>
                  <p className="text-[11px] text-canal-gray-muted truncate">
                    {r.proposed_team_name ? (
                      <>Équipe proposée : <span className="text-canal-yellow">{r.proposed_team_name}</span></>
                    ) : (
                      "Sans nom d'équipe proposé"
                    )}
                  </p>
                  {(svc || lvl) && (
                    <p className="text-[11px] text-canal-gray-muted mt-0.5">
                      {svc}{svc && lvl ? " · " : ""}{lvl ? `${lvl.emoji} ${lvl.label}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => respond(r.id, "accept")}
                    disabled={busy === `resp-${r.id}`}
                    title="Accepter — l'équipe sera créée"
                    aria-label="Accepter la demande"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-canal-green/15 text-canal-green rounded-xl border border-canal-green/30 hover:bg-canal-green/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-canal-green/60 transition-colors disabled:opacity-40"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => respond(r.id, "reject")}
                    disabled={busy === `resp-${r.id}`}
                    title="Refuser"
                    aria-label="Refuser la demande"
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-red-950/30 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-950/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 transition-colors disabled:opacity-40"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Mon statut + actions */}
      {myInTeam ? (
        <div className="canal-card flex items-center gap-3 border border-canal-green/30 bg-canal-green/5">
          <span className="text-2xl">✅</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">
              Tu es déjà dans l&apos;équipe <span className="text-canal-yellow">{myTeamName ?? "—"}</span>
            </p>
            <p className="text-xs text-canal-gray-muted">
              Tu peux quand même aider un collègue à trouver son binôme.
            </p>
          </div>
          <Link
            href="/profile"
            className="shrink-0 text-xs font-bold text-canal-yellow hover:underline"
          >
            Mon équipe →
          </Link>
        </div>
      ) : (
        <div className="canal-card space-y-3 border border-canal-yellow/30 bg-canal-yellow/5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👀</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">Tu cherches un binôme ?</p>
              <p className="text-xs text-canal-gray-muted">
                Propose directement à un collègue ci-dessous, ou crée ton équipe et partage ton code.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href="/profile"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-canal-gray-mid border border-canal-gray-light text-white font-bold rounded-xl text-sm hover:border-canal-yellow/40 transition-colors"
            >
              <Plus size={14} /> Créer mon équipe
            </Link>
            <Link
              href="/profile"
              className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 bg-canal-gray-mid border border-canal-gray-light text-white font-bold rounded-xl text-sm hover:border-canal-yellow/40 transition-colors"
            >
              <Ticket size={14} /> Rejoindre par code
            </Link>
          </div>
        </div>
      )}

      {/* Demande ENVOYÉE en cours. */}
      {activeSent && !myInTeam && (
        <div className="canal-card flex items-center gap-3 border border-canal-yellow/30 bg-canal-yellow/5">
          <Send size={18} className="text-canal-yellow shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              Demande envoyée à {activeSent.target_name}
            </p>
            <p className="text-[11px] text-canal-gray-muted">
              {activeSent.proposed_team_name
                ? <>Équipe proposée : <span className="text-canal-yellow">{activeSent.proposed_team_name}</span> — </>
                : null}
              En attente de sa réponse.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => cancelSent(activeSent.id)}
            loading={busy === `cancel-${activeSent.id}`}
            loadingText="…"
          >
            Annuler
          </Button>
        </div>
      )}

      {/* Filtres */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-canal-gray-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom / pseudo"
            aria-label="Rechercher un participant"
            className="w-full min-h-[44px] bg-canal-gray-mid border border-canal-gray-light rounded-xl pl-9 pr-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow"
          />
        </div>

        {/* Disponibilité — segmenté */}
        <div className="flex gap-1 bg-canal-gray-mid border border-canal-gray-light rounded-xl p-1">
          {([
            { v: "all", label: "Tous" },
            { v: "looking", label: "👀 Cherchent" },
            { v: "in_team", label: "✅ En équipe" },
          ] as { v: Availability; label: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setAvailability(opt.v)}
              className={cn(
                "flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors",
                availability === opt.v ? "bg-canal-yellow text-canal-black" : "text-canal-gray-muted hover:text-white"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <select
            value={serviceId}
            onChange={(e) => setServiceId(e.target.value)}
            aria-label="Filtrer par service"
            className="flex-1 min-h-[40px] bg-canal-gray-mid border border-canal-gray-light rounded-xl px-2 text-white text-sm focus:outline-none focus:border-canal-yellow"
          >
            <option value="all">Tous les services</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            aria-label="Filtrer par niveau foot"
            className="flex-1 min-h-[40px] bg-canal-gray-mid border border-canal-gray-light rounded-xl px-2 text-white text-sm focus:outline-none focus:border-canal-yellow"
          >
            <option value="all">Tous niveaux</option>
            <option value="expert">⚽ Expert</option>
            <option value="amateur">📺 Amateur</option>
            <option value="ambiance">🎉 Ambiance</option>
          </select>
        </div>
      </div>

      {/* Annuaire groupé par service */}
      {filtered.length === 0 ? (
        <p className="text-center text-canal-gray-muted text-sm py-12">
          Aucun participant ne correspond à ces filtres.
        </p>
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <section key={g.id}>
              <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                {g.name} <span className="text-canal-gray-muted">({g.people.length})</span>
              </h2>
              <div className="space-y-2">
                {g.people.map((p) => (
                  <PersonCard
                    key={p.user_id}
                    person={p}
                    isMe={p.user_id === myUserId}
                    // Le viewer peut demander SSI il est sans équipe, la
                    // personne est sans équipe, et ce n'est pas lui-même.
                    canRequest={!myInTeam && !p.team_id && p.user_id !== myUserId}
                    sentToThisPerson={activeSent?.target_user_id === p.user_id}
                    hasActiveSent={!!activeSent}
                    busyAsk={busy === `ask-${p.user_id}`}
                    onAsk={() => { setAskTarget(p); setTeamNameInput(""); setErr(null); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <p className="text-[11px] text-canal-gray-muted italic leading-snug pt-2">
        Cet annuaire sert à former les binômes. Pas de points ni d&apos;activité ici —
        ça, c&apos;est sur les fiches joueurs et les classements.
      </p>

      {/* Modale de confirmation "Demander en binôme" */}
      {askTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-label="Demander en binôme"
          onClick={(e) => { if (e.target === e.currentTarget && !busy) setAskTarget(null); }}
        >
          <div className="w-full max-w-sm canal-card border border-canal-yellow/30 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-canal-yellow/15 border border-canal-yellow/30 flex items-center justify-center shrink-0">
                <UserPlus size={18} className="text-canal-yellow" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white">
                  Proposer un binôme à{" "}
                  <span className="text-canal-yellow">{askTarget.display_name}</span> ?
                </p>
                <p className="text-xs text-canal-gray-muted mt-0.5">
                  S&apos;{askTarget.display_name} accepte, votre équipe Canal Cup
                  sera créée automatiquement avec vous deux.
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="proposed-team-name" className="text-[11px] text-canal-gray-muted font-bold uppercase tracking-wider">
                Nom d&apos;équipe (optionnel)
              </label>
              <input
                id="proposed-team-name"
                type="text"
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                placeholder="ex : Les VARcassés, FC Mauvaise Foi…"
                maxLength={60}
                className="w-full min-h-[44px] bg-canal-gray-mid border border-canal-gray-light rounded-xl px-3 text-white placeholder:text-canal-gray-muted text-sm focus:outline-none focus:border-canal-yellow"
              />
            </div>

            {err && (
              <p className="text-red-400 text-xs flex items-center gap-1.5">
                <AlertCircle size={12} /> {err}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => { if (!busy) setAskTarget(null); }}
              >
                Annuler
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={submitAsk}
                loading={busy === `ask-${askTarget.user_id}`}
                loadingText="Envoi…"
                leftIcon={<Send size={14} />}
              >
                Envoyer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person, isMe, canRequest, sentToThisPerson, hasActiveSent, busyAsk, onAsk,
}: {
  person: BinomeEntry;
  isMe: boolean;
  canRequest: boolean;
  sentToThisPerson: boolean;
  hasActiveSent: boolean;
  busyAsk: boolean;
  onAsk: () => void;
}) {
  const lvl = person.football_level ? LEVEL_META[person.football_level] : null;
  const looking = !person.team_id;

  return (
    <div
      className={cn(
        "bg-canal-gray-mid rounded-xl px-3 py-2.5 flex items-center gap-3",
        isMe && "ring-1 ring-canal-yellow/50"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold text-white truncate">
            {person.full_name ?? person.display_name}
            {isMe && <span className="text-canal-gray-muted font-normal"> (toi)</span>}
          </p>
          {person.full_name && person.display_name !== person.full_name && (
            <span className="text-[11px] text-canal-gray-muted truncate">
              « {person.display_name} »
            </span>
          )}
          {person.is_captain && (
            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-canal-yellow text-canal-black flex items-center gap-1 shrink-0">
              <Crown size={9} /> Capitaine
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {/* Statut équipe */}
          {looking ? (
            <span className="text-[11px] font-bold text-canal-yellow flex items-center gap-1">
              👀 Cherche un binôme
            </span>
          ) : (
            <span className="text-[11px] text-canal-gray-muted flex items-center gap-1 min-w-0">
              <Users size={11} className="shrink-0" />
              <span className="truncate">{person.team_name ?? "En équipe"}</span>
            </span>
          )}

          {/* Niveau foot */}
          {lvl && (
            <span className="text-[11px] text-canal-gray-muted">
              {lvl.emoji} {lvl.label}
            </span>
          )}
        </div>
      </div>

      {/* Action "Demander en binôme" — uniquement entre deux personnes sans
          équipe. Si une demande est déjà envoyée à cette personne : badge. */}
      {sentToThisPerson ? (
        <span className="shrink-0 text-[11px] font-bold text-canal-yellow flex items-center gap-1">
          <Clock size={12} /> Demande envoyée
        </span>
      ) : canRequest ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={onAsk}
          loading={busyAsk}
          loadingText="…"
          disabled={hasActiveSent}
          title={hasActiveSent ? "Tu as déjà une demande en cours" : "Demander en binôme"}
          leftIcon={<UserPlus size={13} />}
          className="shrink-0"
        >
          Demander
        </Button>
      ) : null}
    </div>
  );
}
