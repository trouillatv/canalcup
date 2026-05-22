"use client";

// /admin/feedback — boîte de réception des retours envoyés par les utilisateurs
// via la bulle de feedback. Admin + super_admin (gating via layout + route API).

import { useState, useEffect, useCallback, useMemo } from "react";
import { MessageSquare, Check, Eye, Trash2, RefreshCw } from "lucide-react";

interface Feedback {
  id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  message: string;
  page: string | null;
  status: "new" | "read" | "resolved";
  created_at: string;
}

const STATUS_LABEL: Record<Feedback["status"], string> = {
  new: "Nouveau", read: "Lu", resolved: "Traité",
};
const STATUS_CLASS: Record<Feedback["status"], string> = {
  new: "bg-canal-yellow/20 text-canal-yellow",
  read: "bg-canal-gray-mid text-canal-gray-muted",
  resolved: "bg-green-950/40 text-green-400",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | Feedback["status"]>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/feedback", { credentials: "same-origin" });
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setStatus = async (id: string, status: Feedback["status"]) => {
    setBusy(id);
    await fetch(`/api/admin/feedback/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    setBusy(null);
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer ce retour ?")) return;
    setBusy(id);
    await fetch(`/api/admin/feedback/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((f) => f.id !== id));
    setBusy(null);
  };

  const filtered = useMemo(
    () => items.filter((f) => filter === "all" || f.status === filter),
    [items, filter]
  );
  const newCount = items.filter((f) => f.status === "new").length;

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2">
            <MessageSquare size={22} /> Feedback
          </h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Retours envoyés par les testeurs via la bulle « Un souci ? ».
          </p>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1 text-xs text-canal-gray-muted hover:text-white">
          <RefreshCw size={12} /> Rafraîchir
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {(["all", "new", "read", "resolved"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors ${
              filter === s ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-gray-muted hover:text-white"
            }`}
          >
            {s === "all" ? "Tous" : STATUS_LABEL[s]}
            {s === "new" && newCount > 0 ? ` (${newCount})` : ""}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {loading && <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement…</div>}
        {!loading && filtered.length === 0 && (
          <div className="canal-card text-center py-8 text-canal-gray-muted">Aucun retour ici.</div>
        )}
        {!loading && filtered.map((f) => (
          <div key={f.id} className="canal-card space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[11px] px-1.5 py-0.5 rounded font-bold ${STATUS_CLASS[f.status]}`}>
                {STATUS_LABEL[f.status]}
              </span>
              <span className="text-[11px] text-canal-gray-muted">{fmt(f.created_at)}</span>
            </div>

            <p className="text-sm text-white whitespace-pre-wrap break-words">{f.message}</p>

            <div className="flex flex-wrap gap-x-3 text-[11px] text-canal-gray-muted">
              <span>{f.display_name ?? "—"}</span>
              <span>· {f.email ?? "—"}</span>
              {f.page && <span>· page {f.page}</span>}
            </div>

            <div className="flex flex-wrap gap-2 pt-1 border-t border-canal-gray-light">
              {f.status !== "read" && (
                <button onClick={() => setStatus(f.id, "read")} disabled={busy === f.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-canal-gray-mid text-canal-gray-muted hover:text-white border border-canal-gray-light">
                  <Eye size={12} /> Marquer lu
                </button>
              )}
              {f.status !== "resolved" && (
                <button onClick={() => setStatus(f.id, "resolved")} disabled={busy === f.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-green-950/30 text-green-400 hover:bg-green-950/50">
                  <Check size={12} /> Traité
                </button>
              )}
              <button onClick={() => remove(f.id)} disabled={busy === f.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-red-950/30 text-red-400 hover:bg-red-950/50">
                <Trash2 size={12} /> Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
