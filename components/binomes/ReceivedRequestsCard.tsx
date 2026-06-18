"use client";

// Bloc "Demandes de binôme reçues" pour /profile. Compact : liste les
// demandes pending reçues (quelqu'un propose de former une équipe) avec
// accepter / refuser. À l'acceptation, l'équipe est créée automatiquement
// (cf. /api/binomes/respond) et MyTeamsPanel la reflètera après refresh.
//
// Ne s'affiche QUE s'il y a au moins une demande reçue — sinon rien (on évite
// le bruit visuel quand il n'y a rien à traiter).

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, Check, X, AlertCircle } from "lucide-react";

interface ReceivedRequest {
  id: string;
  requester_name: string;
  proposed_team_name: string | null;
}

export function ReceivedRequestsCard() {
  const router = useRouter();
  const [received, setReceived] = useState<ReceivedRequest[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/binomes/requests", { credentials: "same-origin" });
      if (res.ok) {
        const d = await res.json();
        setReceived(d.received ?? []);
      }
    } catch { /* silencieux */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const respond = async (id: string, decision: "accept" | "reject") => {
    setBusy(`resp-${id}`);
    setErr(null);
    try {
      const res = await fetch("/api/binomes/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ request_id: id, decision }),
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
    // L'acceptation a pu créer l'équipe → rafraîchir le reste de /profile.
    router.refresh();
  };

  if (received.length === 0) return null;

  return (
    <section className="canal-card space-y-2 border border-canal-green/30 bg-canal-green/5" aria-labelledby="binome-received-heading">
      <h2
        id="binome-received-heading"
        className="text-xs text-canal-green font-bold uppercase tracking-wider flex items-center gap-1.5"
      >
        <Inbox size={14} /> Demandes de binôme reçues ({received.length})
      </h2>

      {err && (
        <p className="text-red-400 text-xs flex items-center gap-1.5">
          <AlertCircle size={12} /> {err}
        </p>
      )}

      {received.map((r) => (
        <div key={r.id} className="bg-canal-gray-mid rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {r.requester_name}{" "}
              <span className="font-normal text-canal-gray-muted">te propose un binôme</span>
            </p>
            <p className="text-[11px] text-canal-gray-muted truncate">
              {r.proposed_team_name ? (
                <>Équipe proposée : <span className="text-canal-yellow">{r.proposed_team_name}</span></>
              ) : (
                "Sans nom d'équipe proposé"
              )}
            </p>
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
      ))}

      <Link href="/binomes" className="block text-[11px] text-canal-yellow font-bold hover:underline pt-0.5">
        Trouver un binôme →
      </Link>
    </section>
  );
}
