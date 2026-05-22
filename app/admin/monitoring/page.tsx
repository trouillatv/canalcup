"use client";

// /admin/monitoring — vue de santé externe : clés API, quotas, crons,
// scraping, comparatif sources. Refresh manuel ou auto 30s.

import { useEffect, useState, useCallback } from "react";
import {
  Activity, Key, AlertCircle, CheckCircle2, XCircle, Clock,
  Database, RefreshCw, Cpu, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";

interface KeyStatus {
  state: "ok" | "missing" | "error";
  detail?: string;
}
interface CronRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "success" | "failure";
  error_message: string | null;
  meta: Record<string, unknown> | null;
}
interface CronInfo {
  schedule: string;
  schedule_label: string;
  what: string;
  next_run: string | null;
  last_run: {
    started_at: string;
    finished_at: string | null;
    status: "running" | "success" | "failure";
    hours_ago: number;
  } | null;
  is_late: boolean;
  is_never: boolean;
  errors_last_7d: number;
  runs: CronRun[];
  consumption: {
    last: { gemini_cost_eur?: number; apif_calls?: number };
    total: { gemini_cost_eur: number; apif_calls: number; runs_count: number };
  };
}
interface Monitoring {
  ts: string;
  keys: { gemini: KeyStatus; api_football: KeyStatus };
  consumption_total: { gemini_cost_eur: number; apif_calls: number; runs_count: number };
  quota: {
    api_football: {
      current: number;
      limit_day: number;
      remaining: number;
      plan?: string;
    } | null;
  };
  crons: Record<string, CronInfo>;
  scraping_last: { file: string; mtime: string } | null;
  data_sources: Record<string, { enabled: boolean; features: string[]; cost: string; latency: string; last_used: string | null }>;
  env: { mock_ai: boolean; node_env: string };
}

function StatusPill({ state }: { state: "ok" | "missing" | "error" | "running" | "success" | "failure" }) {
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    ok: { label: "OK", cls: "bg-green-900/30 text-green-400 border-green-500/30", icon: <CheckCircle2 size={11} /> },
    success: { label: "OK", cls: "bg-green-900/30 text-green-400 border-green-500/30", icon: <CheckCircle2 size={11} /> },
    missing: { label: "ABSENTE", cls: "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light", icon: <AlertCircle size={11} /> },
    error: { label: "ERREUR", cls: "bg-red-900/30 text-red-400 border-red-500/30", icon: <XCircle size={11} /> },
    failure: { label: "ÉCHEC", cls: "bg-red-900/30 text-red-400 border-red-500/30", icon: <XCircle size={11} /> },
    running: { label: "EN COURS", cls: "bg-canal-yellow/15 text-canal-yellow border-canal-yellow/30", icon: <Clock size={11} className="animate-pulse" /> },
  };
  const c = map[state] ?? map.missing;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider", c.cls)}>
      {c.icon} {c.label}
    </span>
  );
}

// Toutes les dates affichées sur cette page sont converties en heure
// Nouvelle-Calédonie (UTC+11) — c'est l'heure locale des admins et de
// l'événement Canal Cup. Le serveur stocke en UTC, la conversion se
// fait à l'affichage.
function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Pacific/Noumea",
    });
  } catch { return iso; }
}

function durationMs(start: string, end: string | null): string {
  if (!end) return "…";
  const d = new Date(end).getTime() - new Date(start).getTime();
  if (d < 1000) return `${d}ms`;
  if (d < 60000) return `${(d / 1000).toFixed(1)}s`;
  return `${Math.floor(d / 60000)}min ${Math.floor((d % 60000) / 1000)}s`;
}

// Tableau stratégie quota (constant)
const QUOTA_STRATEGY = [
  { label: "Test perso (1 match/j)", matches: 1, interval: "70s", callsPerMatch: 90 },
  { label: "WC2026 poules (4 matchs/j)", matches: 4, interval: "280s (4min40)", callsPerMatch: 22 },
  { label: "WC2026 ponctuel (6 matchs/j)", matches: 6, interval: "400s (7min)", callsPerMatch: 15 },
];

export default function AdminMonitoringPage() {
  const [data, setData] = useState<Monitoring | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [triggering, setTriggering] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/monitoring", { credentials: "same-origin" });
      if (res.ok) setData(await res.json());
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  const triggerCron = useCallback(async (job: string) => {
    if (!confirm(`Lancer manuellement /api/cron/${job} ?\n\nCela peut consommer du quota API-Football si c'est sync-matches.`)) return;
    setTriggering(job);
    try {
      const res = await fetch("/api/admin/monitoring/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ job }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(`Échec : ${d?.error ?? `HTTP ${res.status}`}`);
      } else {
        alert(`OK ! Status ${d.status}\n\n${JSON.stringify(d.response, null, 2).slice(0, 500)}`);
      }
    } catch (e) {
      alert(`Erreur réseau : ${e instanceof Error ? e.message : ""}`);
    }
    setTriggering(null);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(fetchData, 30000);
    return () => clearInterval(t);
  }, [autoRefresh, fetchData]);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2">
            <Activity size={22} /> Monitoring IA
          </h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Santé des intégrations externes — clés, quotas, crons, scraping.
            <span className="block mt-0.5 text-[10px] italic">
              Toutes les heures en{" "}
              <span className="text-canal-yellow font-bold not-italic">Nouvelle-Calédonie</span>{" "}
              (UTC+11)
            </span>
            {data && <span className="block mt-0.5 text-[11px]">Snapshot : {formatTime(data.ts)}</span>}
          </p>
        </div>
        <div className="flex flex-col gap-2 items-end">
          <Button variant="ghost" size="sm" onClick={fetchData} loading={loading} loadingText="…" leftIcon={<RefreshCw size={11} />}>
            Rafraîchir
          </Button>
          <label className="text-[11px] flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3 h-3 accent-canal-yellow"
            />
            <span className="text-canal-gray-muted">auto 30s</span>
          </label>
        </div>
      </div>

      {!data ? (
        <p className="text-canal-gray-muted text-sm italic">Chargement…</p>
      ) : (
        <>
          {/* ─── Consommation totale (Gemini + API-Football) ─── */}
          <section className="canal-card border border-canal-yellow/30 bg-gradient-to-br from-canal-yellow/5 to-transparent space-y-3">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              💸 Consommation totale (depuis le début)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-yellow/40">
                <p className="text-[10px] uppercase tracking-wider text-canal-yellow font-bold">
                  Gemini (IA)
                </p>
                <p className="text-canal-yellow font-black text-2xl tabular-nums leading-tight mt-1">
                  {data.consumption_total.gemini_cost_eur.toFixed(4)} €
                </p>
                <p className="text-[10px] text-canal-gray-muted mt-0.5">
                  budget 30 € · reste {(30 - data.consumption_total.gemini_cost_eur).toFixed(2)} €
                </p>
              </div>
              <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light">
                <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">
                  API-Football
                </p>
                <p className="text-white font-black text-2xl tabular-nums leading-tight mt-1">
                  {data.consumption_total.apif_calls}
                </p>
                <p className="text-[10px] text-canal-gray-muted mt-0.5">
                  calls cumulés via crons
                </p>
              </div>
              <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light col-span-2 sm:col-span-1">
                <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">
                  Runs cron OK
                </p>
                <p className="text-white font-black text-2xl tabular-nums leading-tight mt-1">
                  {data.consumption_total.runs_count}
                </p>
                <p className="text-[10px] text-canal-gray-muted mt-0.5">
                  tous crons confondus
                </p>
              </div>
            </div>
          </section>

          {/* ─── Clés API ─── */}
          <section className="canal-card space-y-3">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Key size={12} /> Clés API
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-canal-gray-mid rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">Google Gemini</p>
                  <StatusPill state={data.keys.gemini.state} />
                </div>
                <p className="text-[11px] text-canal-gray-muted">
                  {data.keys.gemini.detail ?? "—"}
                </p>
                <p className="text-[10px] text-canal-gray-muted/80 italic">
                  Mode actuel : {data.env.mock_ai ? "MOCK (pas d'appels)" : "Production (appels réels)"}
                </p>
              </div>
              <div className="bg-canal-gray-mid rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-white">API-Football</p>
                  <StatusPill state={data.keys.api_football.state} />
                </div>
                <p className="text-[11px] text-canal-gray-muted">
                  {data.keys.api_football.detail ?? "—"}
                </p>
                {data.quota.api_football && (
                  <>
                    <p className="text-[11px] text-canal-gray-muted">
                      Plan : <span className="text-white font-bold">{data.quota.api_football.plan}</span>
                    </p>
                    <div className="pt-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-canal-yellow font-black text-xl tabular-nums">
                          {data.quota.api_football.current}
                        </span>
                        <span className="text-canal-gray-muted text-xs">
                          / {data.quota.api_football.limit_day} aujourd&apos;hui
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-canal-gray-light/30 mt-1 overflow-hidden">
                        <div
                          className={cn(
                            "h-full transition-all",
                            data.quota.api_football.current / data.quota.api_football.limit_day > 0.8
                              ? "bg-red-400"
                              : data.quota.api_football.current / data.quota.api_football.limit_day > 0.5
                                ? "bg-canal-yellow"
                                : "bg-green-400"
                          )}
                          style={{ width: `${Math.min(100, (data.quota.api_football.current / data.quota.api_football.limit_day) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-canal-gray-muted mt-1">
                        reste {data.quota.api_football.remaining} calls aujourd&apos;hui
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          {/* ─── Alerte globale crons en haut si quelque chose va mal ─── */}
          {(() => {
            const issues: string[] = [];
            Object.entries(data.crons).forEach(([job, c]) => {
              if (c.is_never) issues.push(`${job} jamais exécuté`);
              else if (c.is_late) issues.push(`${job} en retard (${c.last_run?.hours_ago.toFixed(1)}h)`);
              if (c.errors_last_7d > 0) issues.push(`${job} : ${c.errors_last_7d} erreur(s) sur 7j`);
            });
            if (issues.length === 0) return null;
            return (
              <div className="canal-card border border-red-500/40 bg-red-950/20 space-y-1">
                <p className="text-red-400 font-bold text-sm flex items-center gap-2">
                  <AlertCircle size={14} /> Alertes crons
                </p>
                <ul className="text-xs text-canal-gray-muted space-y-0.5">
                  {issues.map((i, idx) => (
                    <li key={idx}>• {i}</li>
                  ))}
                </ul>
              </div>
            );
          })()}

          {/* ─── Crons ─── */}
          <section className="canal-card space-y-4">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Calendar size={12} /> Crons (schedule + état + derniers lancements)
            </h2>
            <div className="space-y-4">
              {Object.entries(data.crons).map(([job, c]) => {
                // Couleur de fond selon état
                const cardBorder =
                  c.is_never || c.errors_last_7d > 0
                    ? "border border-red-500/40 bg-red-950/10"
                    : c.is_late
                      ? "border border-canal-yellow/40 bg-canal-yellow/5"
                      : "border border-canal-gray-light/40";
                return (
                  <div key={job} className={cn("rounded-xl p-3 space-y-2.5", cardBorder)}>
                    {/* En-tête : nom + statut global + trigger */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">
                        /api/cron/{job}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {c.is_never && <StatusPill state="error" />}
                        {!c.is_never && c.is_late && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-canal-yellow/15 text-canal-yellow border-canal-yellow/30 text-[10px] font-bold uppercase tracking-wider">
                            <Clock size={11} /> EN RETARD
                          </span>
                        )}
                        {!c.is_never && !c.is_late && c.last_run && (
                          <StatusPill state={c.last_run.status} />
                        )}
                        {c.errors_last_7d > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-red-900/30 text-red-400 border-red-500/30 text-[10px] font-bold tabular-nums">
                            {c.errors_last_7d} ⚠ /7j
                          </span>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => triggerCron(job)}
                          loading={triggering === job}
                          loadingText="…"
                        >
                          ▶ Lancer
                        </Button>
                      </div>
                    </div>

                    {/* Ce que fait le cron — rappel en italique */}
                    {c.what && (
                      <p className="text-[11px] text-canal-gray-muted leading-relaxed italic border-l-2 border-canal-yellow/30 pl-2">
                        {c.what}
                      </p>
                    )}

                    {/* Schedule + next run */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <p className="text-canal-gray-muted">Schedule</p>
                        <p className="text-white font-mono">{c.schedule}</p>
                        <p className="text-[10px] text-canal-gray-muted italic">{c.schedule_label}</p>
                      </div>
                      <div>
                        <p className="text-canal-gray-muted">Dernier lancement</p>
                        {c.last_run ? (
                          <>
                            <p className="text-white tabular-nums">{formatTime(c.last_run.started_at)}</p>
                            <p className="text-[10px] text-canal-gray-muted">
                              il y a {c.last_run.hours_ago.toFixed(1)}h ({durationMs(c.last_run.started_at, c.last_run.finished_at)})
                            </p>
                          </>
                        ) : (
                          <p className="text-red-400">jamais</p>
                        )}
                      </div>
                      <div>
                        <p className="text-canal-gray-muted">Prochain prévu</p>
                        <p className="text-white tabular-nums">{formatTime(c.next_run)}</p>
                      </div>
                    </div>

                    {/* Conso : dernier run + total */}
                    <div className="bg-canal-gray-mid/50 rounded-lg px-2.5 py-2 border border-canal-gray-light/30">
                      <p className="text-[10px] text-canal-gray-muted uppercase tracking-wider mb-1">Consommation</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div>
                          <p className="text-canal-gray-muted">Dernier run</p>
                          <p className="text-white tabular-nums">
                            {c.consumption.last.gemini_cost_eur !== undefined && (
                              <span className="block">
                                Gemini : <span className="text-canal-yellow">{c.consumption.last.gemini_cost_eur.toFixed(4)} €</span>
                              </span>
                            )}
                            {c.consumption.last.apif_calls !== undefined && (
                              <span className="block">
                                API-Foot : <span className="text-canal-yellow">{c.consumption.last.apif_calls} calls</span>
                              </span>
                            )}
                            {c.consumption.last.gemini_cost_eur === undefined &&
                              c.consumption.last.apif_calls === undefined && (
                                <span className="italic text-canal-gray-muted">—</span>
                              )}
                          </p>
                        </div>
                        <div>
                          <p className="text-canal-gray-muted">Total depuis début</p>
                          <p className="text-white tabular-nums">
                            <span className="block">
                              Gemini : <span className="text-canal-yellow">{c.consumption.total.gemini_cost_eur.toFixed(4)} €</span>
                            </span>
                            <span className="block">
                              API-Foot : <span className="text-canal-yellow">{c.consumption.total.apif_calls} calls</span>
                            </span>
                            <span className="block text-[10px] text-canal-gray-muted">
                              sur {c.consumption.total.runs_count} run{c.consumption.total.runs_count > 1 ? "s" : ""} OK
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Derniers runs détaillés */}
                    {c.runs.length > 0 && (
                      <div className="pt-2 border-t border-canal-gray-light/30 space-y-1">
                        <p className="text-[10px] text-canal-gray-muted uppercase tracking-wider">
                          {c.runs.length} dernier{c.runs.length > 1 ? "s" : ""} lancement{c.runs.length > 1 ? "s" : ""}
                        </p>
                        {c.runs.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-start gap-2 bg-canal-gray-mid rounded-lg px-2.5 py-1.5"
                          >
                            <StatusPill state={r.status} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-canal-gray-muted tabular-nums">
                                {formatTime(r.started_at)} · {durationMs(r.started_at, r.finished_at)}
                              </p>
                              {r.error_message && (
                                <p className="text-[10px] text-red-400 break-words">
                                  ❌ {r.error_message}
                                </p>
                              )}
                              {r.meta && Object.keys(r.meta).length > 0 && !r.error_message && (
                                <p className="text-[10px] text-canal-gray-muted/80 break-words font-mono">
                                  {JSON.stringify(r.meta)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* ─── Scraping ─── */}
          <section className="canal-card space-y-2">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={12} /> Scraping Python (enrichissement joueurs WC2026)
            </h2>
            {data.scraping_last ? (
              <div className="bg-canal-gray-mid rounded-xl p-3 space-y-1">
                <p className="text-sm text-white">
                  Dernier fichier : <code className="font-mono text-canal-yellow text-xs">{data.scraping_last.file}</code>
                </p>
                <p className="text-[11px] text-canal-gray-muted">
                  Modifié le {formatTime(data.scraping_last.mtime)}
                </p>
                <p className="text-[10px] text-canal-gray-muted italic">
                  Lancement manuel : <code>node docs/script/enrich_players.py</code>
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-canal-gray-muted italic">
                Aucun fichier scrapping détecté dans docs/script/output/.
              </p>
            )}
          </section>

          {/* ─── Comparatif sources ─── */}
          <section className="canal-card space-y-3">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Database size={12} /> Comparatif des sources data
            </h2>
            <div className="space-y-2">
              {Object.entries(data.data_sources).map(([name, src]) => (
                <div key={name} className="bg-canal-gray-mid rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-white">{name}</p>
                    <StatusPill state={src.enabled ? "ok" : "missing"} />
                  </div>
                  <p className="text-[11px] text-canal-gray-muted">
                    <span className="text-white font-bold">Données :</span> {src.features.join(", ")}
                  </p>
                  <p className="text-[11px] text-canal-gray-muted">
                    <span className="text-white font-bold">Coût :</span> {src.cost}
                  </p>
                  <p className="text-[11px] text-canal-gray-muted">
                    <span className="text-white font-bold">Latence :</span> {src.latency}
                  </p>
                  <p className="text-[11px] text-canal-gray-muted">
                    <span className="text-white font-bold">Dernière utilisation :</span>{" "}
                    <span className={src.last_used ? "text-white tabular-nums" : "text-canal-gray-muted italic"}>
                      {src.last_used ? formatTime(src.last_used) : "jamais"}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Stratégie quota (constantes) ─── */}
          <section className="canal-card space-y-3">
            <h2 className="text-xs text-canal-yellow font-bold uppercase tracking-wider flex items-center gap-1.5">
              📊 Stratégie quota API-Football
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-canal-gray-muted text-left">
                    <th className="py-1.5 pr-3">Cas</th>
                    <th className="py-1.5 pr-3 text-center">--matches</th>
                    <th className="py-1.5 pr-3 text-center">Interval</th>
                    <th className="py-1.5 text-center">Calls/match</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {QUOTA_STRATEGY.map((row) => (
                    <tr key={row.label} className="border-t border-canal-gray-light/30">
                      <td className="py-1.5 pr-3">{row.label}</td>
                      <td className="py-1.5 pr-3 text-center font-mono">{row.matches}</td>
                      <td className="py-1.5 pr-3 text-center font-mono text-canal-yellow">{row.interval}</td>
                      <td className="py-1.5 text-center font-mono">{row.callsPerMatch}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-canal-gray-muted italic">
              Chaque tick = 2 calls (fixture + events). Pour rester strict : doubler{" "}
              <code>--matches</code>. Compos = 1 sync unique en init (statique).
            </p>
          </section>
        </>
      )}
    </div>
  );
}
