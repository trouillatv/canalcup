"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModerationReport } from "@/lib/supabase/types";

const RISK_STYLE = {
  low: "text-green-300 bg-green-950/30 border-green-500/30",
  medium: "text-orange-300 bg-orange-950/30 border-orange-500/30",
  high: "text-red-300 bg-red-950/30 border-red-500/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function VestiaireAlertesPage() {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const fetchReports = async () => {
    const res = await fetch("/api/admin/moderation-reports", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data)) setReports(data);
  };

  useEffect(() => {
    fetchReports().finally(() => setLoading(false));
  }, []);

  const updateStatus = async (id: string, status: "reviewed" | "ignored") => {
    setBusy(id + status);
    await fetch(`/api/admin/moderation-reports/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await fetchReports();
    setBusy(null);
  };

  return (
    <div className="px-4 py-4 max-w-3xl mx-auto space-y-5">
      <header>
        <div className="flex items-center gap-2">
          <ShieldAlert size={21} className="text-canal-yellow" />
          <h1 className="canal-headline text-2xl">Alertes Vestiaire</h1>
        </div>
        <p className="text-sm text-canal-gray-muted mt-1">
          Synthese quotidienne IA du Fil et du Vestiaire. Rien n'est masque automatiquement.
        </p>
      </header>

      {loading && <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement...</div>}

      <div className="space-y-3">
        {!loading && reports.map((report) => (
          <article key={report.id} className="canal-card space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", RISK_STYLE[report.risk_level])}>
                    {report.risk_level.toUpperCase()}
                  </span>
                  {report.status !== "new" && (
                    <span className="text-xs text-canal-gray-muted">Traite : {report.status}</span>
                  )}
                </div>
                <p className="text-white font-black mt-2">{report.summary}</p>
                <p className="text-xs text-canal-gray-muted mt-1">
                  Fenetre : {formatDate(report.window_start)} - {formatDate(report.window_end)}
                </p>
              </div>
              <AlertTriangle
                size={20}
                className={report.risk_level === "high" ? "text-red-300" : "text-canal-yellow"}
              />
            </div>

            {report.recommendation && (
              <p className="rounded-xl bg-canal-gray-mid border border-canal-gray-light px-3 py-2 text-sm text-canal-gray-light">
                {report.recommendation}
              </p>
            )}

            {report.flagged_items?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black uppercase text-canal-gray-muted">Messages a verifier</p>
                {report.flagged_items.map((item, index) => (
                  <div key={`${item.id}-${index}`} className="rounded-xl border border-canal-gray-light bg-canal-gray-mid px-3 py-2">
                    <div className="flex items-center gap-2 text-xs text-canal-gray-muted">
                      <span>{item.source}</span>
                      {item.channel && <span>{item.channel}</span>}
                      {item.author && <span>{item.author}</span>}
                    </div>
                    <p className="text-sm text-white mt-1">"{item.excerpt}"</p>
                    <p className="text-xs text-orange-200/80 mt-1">{item.reason}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-2 border-t border-canal-gray-light">
              <button
                onClick={() => updateStatus(report.id, "reviewed")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-canal-yellow px-3 py-2 text-xs font-black text-canal-black disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                {busy === report.id + "reviewed" ? "..." : "Marquer verifie"}
              </button>
              <button
                onClick={() => updateStatus(report.id, "ignored")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-lg bg-canal-gray-mid border border-canal-gray-light px-3 py-2 text-xs font-black text-canal-gray-muted hover:text-white disabled:opacity-50"
              >
                <Eye size={14} />
                Ignorer
              </button>
            </div>
          </article>
        ))}

        {!loading && reports.length === 0 && (
          <div className="canal-card text-center py-8">
            <ShieldAlert size={32} className="mx-auto mb-2 text-canal-gray-muted" />
            <p className="font-bold text-white">Aucun rapport pour le moment.</p>
            <p className="text-sm text-canal-gray-muted mt-1">Le cron quotidien remplira cette page.</p>
          </div>
        )}
      </div>
    </div>
  );
}
