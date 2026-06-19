"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Entry {
  id: string;
  team_id: string;
  team_name: string;
  title: string | null;
  photo_url: string;
  status: string;
  podium_rank: number | null;
  participation_awarded: boolean;
  votes_count: number;
  created_at: string;
}
interface Data {
  settings: { votes_open: boolean; results_published: boolean };
  entries: Entry[];
  totalVotes: number;
}

const STATUS_BADGE: Record<string, string> = {
  submitted: "bg-amber-900/40 text-amber-300",
  approved: "bg-green-900/40 text-green-300",
  hidden: "bg-red-900/40 text-red-300",
  draft: "bg-canal-gray-light text-canal-gray-muted",
};
const MEDAL = ["🥇", "🥈", "🥉"];

export function SupportersAdminClient() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/admin/supporters").then((r) => r.json()).then((d) => { if (!d.error) setData(d); }).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  const act = async (action: string, entry_id?: string) => {
    setBusy(true); setFlash(null);
    try {
      const res = await fetch("/api/admin/supporters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entry_id }),
      });
      const d = await res.json();
      if (!res.ok) setFlash(d.error ?? "Échec.");
      else load();
    } finally { setBusy(false); }
  };

  if (!data) {
    return <div className="text-canal-gray-muted text-sm flex items-center gap-2"><RefreshCw size={14} className="animate-spin" /> Chargement…</div>;
  }

  const { settings, entries, totalVotes } = data;
  const submitted = entries.filter((e) => e.status === "submitted");
  const others = entries.filter((e) => e.status !== "submitted");

  return (
    <div className="space-y-5">
      {flash && <div className="text-sm rounded-lg p-3 bg-red-950/30 text-red-300 border border-red-500/30">{flash}</div>}

      {/* Pilotage du concours */}
      <section className="canal-card space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">Pilotage</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded text-xs font-bold ${settings.votes_open ? "bg-green-900/40 text-green-300" : "bg-canal-gray-light text-canal-gray-muted"}`}>
            Votes {settings.votes_open ? "OUVERTS" : "fermés"}
          </span>
          <span className={`px-2 py-1 rounded text-xs font-bold ${settings.results_published ? "bg-canal-yellow/20 text-canal-yellow" : "bg-canal-gray-light text-canal-gray-muted"}`}>
            Résultats {settings.results_published ? "publiés" : "non publiés"}
          </span>
          <span className="text-xs text-canal-gray-muted ml-auto">{totalVotes} vote{totalVotes > 1 ? "s" : ""}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {!settings.votes_open ? (
            <button disabled={busy} onClick={() => act("open_votes")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-600 text-white disabled:opacity-50">Ouvrir les votes</button>
          ) : (
            <button disabled={busy} onClick={() => act("close_votes")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-canal-gray-light text-white disabled:opacity-50">Fermer les votes</button>
          )}
          {!settings.results_published ? (
            <button disabled={busy} onClick={() => act("publish_results")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-canal-yellow text-canal-black disabled:opacity-50">Clôturer & publier le podium</button>
          ) : (
            <button disabled={busy} onClick={() => act("unpublish_results")} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-canal-gray-light text-white disabled:opacity-50">Dépublier les résultats</button>
          )}
        </div>
        <p className="text-[11px] text-canal-gray-muted">Publier le podium attribue automatiquement +40/+30/+20 au top 3 (idempotent : recalcul possible).</p>
      </section>

      {/* À valider */}
      <section className="space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">À valider ({submitted.length})</h2>
        {submitted.length === 0 && <p className="text-sm text-canal-gray-muted">Rien en attente.</p>}
        {submitted.map((e) => <AdminEntryCard key={e.id} e={e} busy={busy} act={act} />)}
      </section>

      {/* Galerie complète */}
      <section className="space-y-3">
        <h2 className="text-xs text-canal-yellow font-bold uppercase">Toutes les photos ({others.length})</h2>
        {others.map((e) => <AdminEntryCard key={e.id} e={e} busy={busy} act={act} />)}
      </section>
    </div>
  );

  function AdminEntryCard({ e, busy, act }: { e: Entry; busy: boolean; act: (a: string, id?: string) => void }) {
    return (
      <div className="canal-card flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={e.photo_url} alt={e.title ?? e.team_name} className="w-20 h-20 rounded-lg object-cover shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-white truncate">{e.team_name}</p>
            <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold ${STATUS_BADGE[e.status] ?? ""}`}>{e.status}</span>
            {e.podium_rank && <span className="text-sm">{MEDAL[e.podium_rank - 1]}</span>}
          </div>
          {e.title && <p className="text-xs text-canal-gray-muted truncate">{e.title}</p>}
          <p className="text-[11px] text-canal-gray-muted">{e.votes_count} vote{e.votes_count > 1 ? "s" : ""}{e.participation_awarded ? " · +10 attribués" : ""}</p>
          <div className="flex gap-2 pt-1">
            {e.status !== "approved" && (
              <button disabled={busy} onClick={() => act("approve", e.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-600 text-white disabled:opacity-50">Valider</button>
            )}
            {e.status !== "hidden" && (
              <button disabled={busy} onClick={() => act("hide", e.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-700 text-white disabled:opacity-50">Masquer</button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
