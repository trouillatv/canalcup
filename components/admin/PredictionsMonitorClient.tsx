"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCopy,
  CircleDashed,
  ClipboardList,
  Download,
  Filter,
  Medal,
  Sigma,
  Send,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type {
  PredictionMonitorPayload,
  PredictionMonitorUserRow,
} from "@/lib/data/predictions-monitor";

type SortMode = "validated_at" | "team" | "service" | "score";
type TabKey = "predicted" | "missing" | "summary";

interface MonitorResponse extends PredictionMonitorPayload {
  error?: string;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Pacific/Noumea",
    });
  } catch {
    return iso;
  }
}

function formatCountdown(targetIso: string | null | undefined): string {
  if (!targetIso) return "—";
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return "verrouillé";
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}j ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function outcomeLabel(value: PredictionMonitorUserRow["outcome"]): string {
  switch (value) {
    case "exact":
      return "score exact";
    case "correct_result":
      return "bon résultat";
    case "correct_diff":
      return "bonne différence";
    case "wrong":
      return "raté";
    default:
      return "en attente";
  }
}

function outcomeClass(value: PredictionMonitorUserRow["outcome"]): string {
  switch (value) {
    case "exact":
      return "text-green-400 bg-green-950/30";
    case "correct_result":
      return "text-canal-yellow bg-canal-yellow/10";
    case "correct_diff":
      return "text-blue-300 bg-blue-950/30";
    case "wrong":
      return "text-red-400 bg-red-950/30";
    default:
      return "text-canal-gray-muted bg-canal-gray-mid";
  }
}

function scoreString(a: number | null, b: number | null): string {
  if (a == null || b == null) return "—";
  return `${a}-${b}`;
}

function progressWidth(value: number): string {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function PredictionsMonitorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMatchId = searchParams.get("matchId");

  const [data, setData] = useState<MonitorResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<TabKey>("predicted");
  const [sortMode, setSortMode] = useState<SortMode>("validated_at");
  const [, setTick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [pushFeedback, setPushFeedback] = useState("");

  useEffect(() => {
    const timer = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = async (matchId?: string | null) => {
    setLoading(true);
    setError("");
    const qs = matchId ? `?matchId=${encodeURIComponent(matchId)}` : "";
    const res = await fetch(`/api/admin/predictions-monitor${qs}`, { credentials: "same-origin" });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(payload?.error ?? "Impossible de charger le suivi des pronostics.");
      setData(null);
      setLoading(false);
      return;
    }
    setData(payload as MonitorResponse);
    setLoading(false);

    if (!matchId && payload?.defaultMatchId) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("matchId", payload.defaultMatchId);
      router.replace(`/admin/predictions-monitor?${params.toString()}`);
    }
  };

  useEffect(() => {
    load(urlMatchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlMatchId]);

  const selectMatch = (matchId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("matchId", matchId);
    router.replace(`/admin/predictions-monitor?${params.toString()}`);
  };

  const activeMatch = data?.match ?? null;
  const predicted = useMemo(() => {
    if (!data) return [];
    const rows = [...data.predictedUsers];
    switch (sortMode) {
      case "team":
        return rows.sort((a, b) => (a.team_name ?? "").localeCompare(b.team_name ?? "", "fr") || a.display_name.localeCompare(b.display_name, "fr"));
      case "service":
        return rows.sort((a, b) => (a.service_name ?? "").localeCompare(b.service_name ?? "", "fr") || a.display_name.localeCompare(b.display_name, "fr"));
      case "score":
        return rows.sort((a, b) => {
          const sa = (a.predicted_score_a ?? -1) * 100 + (a.predicted_score_b ?? -1);
          const sb = (b.predicted_score_a ?? -1) * 100 + (b.predicted_score_b ?? -1);
          return sa - sb || a.display_name.localeCompare(b.display_name, "fr");
        });
      case "validated_at":
      default:
        return rows.sort((a, b) => {
          const ta = new Date(a.prediction_updated_at ?? a.prediction_created_at ?? 0).getTime();
          const tb = new Date(b.prediction_updated_at ?? b.prediction_created_at ?? 0).getTime();
          return tb - ta || a.display_name.localeCompare(b.display_name, "fr");
        });
    }
  }, [data, sortMode]);

  const missing = useMemo(() => data?.missingUsers ?? [], [data]);
  const copyMissingEmails = async () => {
    if (!missing.length) return;
    await navigator.clipboard.writeText(missing.map((u) => u.email).join(", "));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const goMatch = (direction: -1 | 1) => {
    if (!data) return;
    const currentIndex = data.matches.findIndex((m) => m.id === activeMatch?.id);
    const next = data.matches[currentIndex + direction];
    if (next) selectMatch(next.id);
  };

  const goShortcut = (target: string | null) => {
    if (target) selectMatch(target);
  };

  const sendIndividualPush = async (user: { user_id: string; display_name: string }) => {
    if (!activeMatch) return;
    setSendingTo(user.user_id);
    setPushFeedback("");
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Canal Cup",
          body: `${user.display_name}, pense à ${activeMatch.team_a} vs ${activeMatch.team_b}.`,
          url: `/matches/${activeMatch.id}`,
          userIds: [user.user_id],
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPushFeedback(payload?.error ?? "Envoi impossible.");
      } else {
        setPushFeedback(`Push envoyé à ${user.display_name}`);
      }
    } finally {
      setSendingTo(null);
      window.setTimeout(() => setPushFeedback(""), 2500);
    }
  };

  return (
    <div className="px-4 py-4 max-w-5xl mx-auto space-y-5 pb-24">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2">
            <ClipboardList size={22} /> Suivi des pronostics
          </h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Vue match par match pour suivre la participation et l’état des pronostics.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => load(urlMatchId)} loading={loading} loadingText="…" leftIcon={<ArrowRight size={12} className="rotate-45" />}>
          Rafraîchir
        </Button>
      </div>

      {error && <div className="canal-card border border-red-500/40 text-red-400 text-sm">{error}</div>}
      {pushFeedback && <div className="canal-card border border-canal-yellow/30 text-canal-yellow text-sm">{pushFeedback}</div>}

      <section className="canal-card space-y-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wider text-canal-yellow font-bold">Match</p>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-white truncate">
                  {activeMatch ? `${activeMatch.team_a} vs ${activeMatch.team_b}` : "Chargement…"}
                </h2>
                {activeMatch && (
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                    activeMatch.status === "finished"
                      ? "bg-green-950/30 text-green-400"
                      : activeMatch.status === "live" || activeMatch.status === "halftime"
                        ? "bg-canal-yellow/15 text-canal-yellow"
                        : "bg-canal-gray-mid text-canal-gray-muted"
                  )}>
                    {activeMatch.status === "finished" ? "terminé" : activeMatch.status === "live" || activeMatch.status === "halftime" ? "live" : "à venir"}
                  </span>
                )}
              </div>
              {activeMatch && (
                <p className="text-xs text-canal-gray-muted mt-1">
                  Coup d&apos;envoi : <span className="text-white">{formatTime(activeMatch.starts_at)}</span>
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => goMatch(-1)} disabled={!data?.previousMatchId} leftIcon={<ArrowLeft size={12} />}>
                Match précédent
              </Button>
              <Button variant="secondary" size="sm" onClick={() => goMatch(1)} disabled={!data?.nextMatchId} rightIcon={<ArrowRight size={12} />}>
                Match suivant
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light">
              <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Pronostics</p>
              <p className="text-canal-yellow font-black text-2xl tabular-nums mt-1">{data?.summaryStats.predicted_count ?? 0} / {data?.summaryStats.eligible_count ?? 0}</p>
            </div>
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light">
              <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Manquants</p>
              <p className="text-white font-black text-2xl tabular-nums mt-1">{data?.summaryStats.missing_count ?? 0}</p>
            </div>
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-yellow/30">
              <p className="text-[10px] uppercase tracking-wider text-canal-yellow font-bold">Taux</p>
              <p className="text-canal-yellow font-black text-2xl tabular-nums mt-1">{(data?.summaryStats.participation_rate ?? 0).toFixed(1)}%</p>
            </div>
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light">
              <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Verrouillage</p>
              <p className="text-white font-black text-xl tabular-nums mt-1">
                {activeMatch ? formatCountdown(activeMatch.starts_at) : "—"}
              </p>
              <p className="text-[10px] text-canal-gray-muted mt-0.5">compte à rebours avant fermeture</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-canal-gray-muted">Sélecteur</label>
            <select
              value={activeMatch?.id ?? ""}
              onChange={(e) => selectMatch(e.target.value)}
              className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-3 py-2 text-sm text-white min-w-[260px] flex-1"
            >
              {(data?.matches ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.team_a} vs {m.team_b} · {formatTime(m.starts_at)}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={() => goShortcut(data?.todayMatchId ?? null)} disabled={!data?.todayMatchId} leftIcon={<CalendarDays size={12} />}>
              Match du jour
            </Button>
            <Button variant="ghost" size="sm" onClick={() => goShortcut(data?.nextUpcomingMatchId ?? null)} disabled={!data?.nextUpcomingMatchId} leftIcon={<CircleDashed size={12} />}>
              Prochain à venir
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        {([
          { key: "predicted", label: "Ont pronostiqué", icon: <Users size={12} /> },
          { key: "missing", label: "Manquants", icon: <ClipboardCopy size={12} /> },
          { key: "summary", label: "Synthèse", icon: <BarChart3 size={12} /> },
        ] as const).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={cn(
              "px-3 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-1.5 border",
              tab === item.key
                ? "bg-canal-yellow text-canal-black border-canal-yellow"
                : "bg-canal-gray-mid text-canal-gray-muted border-canal-gray-light hover:text-white"
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </section>

      {tab === "predicted" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">
              Ont pronostiqué ({predicted.length})
            </p>
            <div className="flex items-center gap-2">
              <Filter size={12} className="text-canal-gray-muted" />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-canal-gray-mid border border-canal-gray-light rounded-lg px-2 py-1.5 text-xs text-white"
              >
                <option value="validated_at">Dernière validation</option>
                <option value="team">Équipe</option>
                <option value="service">Service</option>
                <option value="score">Score</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            {predicted.map((u) => (
              <div key={u.user_id} className="canal-card space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{u.display_name}</p>
                    <p className="text-xs text-canal-gray-muted truncate">
                      {u.login} · {u.service_name ?? "Sans service"} · {u.team_name ?? "Sans équipe"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={cn("text-[10px] font-bold uppercase px-2 py-1 rounded-full", outcomeClass(u.outcome))}>
                      {outcomeLabel(u.outcome)}
                    </span>
                    {u.points != null && (
                      <span className="text-[10px] text-canal-gray-muted tabular-nums">{u.points} pts</span>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendIndividualPush(u)}
                      loading={sendingTo === u.user_id}
                      loadingText="…"
                      leftIcon={<Send size={11} />}
                    >
                      Push
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-canal-gray-mid rounded-lg px-2.5 py-2">
                    <p className="text-canal-gray-muted">Score</p>
                    <p className="text-white font-black">{scoreString(u.predicted_score_a, u.predicted_score_b)}</p>
                  </div>
                  <div className="bg-canal-gray-mid rounded-lg px-2.5 py-2">
                    <p className="text-canal-gray-muted">Service</p>
                    <p className="text-white font-medium truncate">{u.service_name ?? "—"}</p>
                  </div>
                  <div className="bg-canal-gray-mid rounded-lg px-2.5 py-2">
                    <p className="text-canal-gray-muted">Équipe</p>
                    <p className="text-white font-medium truncate">{u.team_name ?? "—"}</p>
                  </div>
                  <div className="bg-canal-gray-mid rounded-lg px-2.5 py-2">
                    <p className="text-canal-gray-muted">Dernière modif.</p>
                    <p className="text-white font-medium">{formatTime(u.prediction_updated_at)}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span className="px-2 py-1 rounded-full bg-canal-gray-mid text-canal-gray-muted">
                    {u.profile_completed ? "profil OK" : "profil incomplet"}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-canal-gray-mid text-canal-gray-muted">
                    {u.has_team ? "avec équipe" : "sans équipe"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "missing" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">
              Manquants ({missing.length})
            </p>
            <Button variant="secondary" size="sm" onClick={copyMissingEmails} leftIcon={<ClipboardCopy size={12} />}>
              {copied ? "Emails copiés" : "Copier les emails"}
            </Button>
          </div>

          <div className="space-y-2">
            {missing.map((u) => (
              <div key={u.user_id} className="canal-card flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{u.display_name}</p>
                    <p className="text-xs text-canal-gray-muted truncate">
                      {u.login} · {u.service_name ?? "Sans service"} · {u.team_name ?? "Sans équipe"}
                    </p>
                  </div>
                  <span className={cn(
                    "text-[10px] font-bold uppercase px-2 py-1 rounded-full",
                    u.status_label === "OK"
                      ? "bg-green-950/30 text-green-400"
                      : u.status_label === "sans équipe"
                        ? "bg-canal-yellow/10 text-canal-yellow"
                        : "bg-red-950/30 text-red-400"
                  )}>
                    {u.status_label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-canal-gray-muted">{u.email}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => sendIndividualPush(u)}
                    loading={sendingTo === u.user_id}
                    loadingText="…"
                    leftIcon={<Send size={11} />}
                  >
                    Push
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "summary" && data && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard
              title="Score le plus joué"
              value={data.summaryStats.most_played_score ? `${data.summaryStats.most_played_score.predicted_score_a}-${data.summaryStats.most_played_score.predicted_score_b}` : "—"}
              sub={data.summaryStats.most_played_score ? `${data.summaryStats.most_played_score.count} fois` : "Aucun prono"}
              icon={<Medal size={14} />}
            />
            <SummaryCard
              title="Scores différents"
              value={String(data.summaryStats.distinct_scores)}
              sub="combinaisons uniques"
              icon={<Sigma size={14} />}
            />
            <SummaryCard
              title="Distribution"
              value={`${data.summaryStats.score_distribution.a}% / ${data.summaryStats.score_distribution.draw}% / ${data.summaryStats.score_distribution.b}%`}
              sub="victoire A / nul / victoire B"
              icon={<BarChart3 size={14} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SummaryCard
              title="Équipe la plus active"
              value={data.summaryStats.team_most_active?.name ?? "—"}
              sub={
                data.summaryStats.team_most_active
                  ? `${data.summaryStats.team_most_active.predicted}/${data.summaryStats.team_most_active.total} · ${data.summaryStats.team_most_active.participation_rate.toFixed(1)}%`
                  : "aucune donnée"
              }
              icon={<Users size={14} />}
            />
            <SummaryCard
              title="Service le plus actif"
              value={data.summaryStats.service_most_active?.name ?? "—"}
              sub={
                data.summaryStats.service_most_active
                  ? `${data.summaryStats.service_most_active.predicted}/${data.summaryStats.service_most_active.total} · ${data.summaryStats.service_most_active.participation_rate.toFixed(1)}%`
                  : "aucune donnée"
              }
              icon={<Download size={14} />}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <BucketList title="Participation par équipe" buckets={data.summaryStats.team_participation} />
            <BucketList title="Participation par service" buckets={data.summaryStats.service_participation} />
          </div>

          <div className="canal-card space-y-2">
            <p className="text-xs font-bold text-canal-yellow uppercase tracking-wider">Statut du match</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <MiniStat label="Started" value={data.summaryStats.started ? "oui" : "non"} />
              <MiniStat label="Live" value={data.summaryStats.live ? "oui" : "non"} />
              <MiniStat label="Terminé" value={data.summaryStats.finished ? "oui" : "non"} />
              <MiniStat label="Exacts" value={String(data.summaryStats.exact_count)} />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ title, value, sub, icon }: { title: string; value: string; sub: string; icon: React.ReactNode }) {
  return (
    <div className="canal-card space-y-2">
      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold flex items-center gap-1.5">
        {icon}
        {title}
      </p>
      <p className="text-white font-black text-xl leading-tight">{value}</p>
      <p className="text-[11px] text-canal-gray-muted">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-canal-gray-mid rounded-lg px-2.5 py-2 border border-canal-gray-light">
      <p className="text-[10px] text-canal-gray-muted uppercase tracking-wider">{label}</p>
      <p className="text-white font-bold mt-0.5">{value}</p>
    </div>
  );
}

function BucketList({
  title,
  buckets,
}: {
  title: string;
  buckets: Array<{ id: string; name: string; total: number; predicted: number; participation_rate: number }>;
}) {
  return (
    <div className="canal-card space-y-3">
      <p className="text-xs font-bold text-canal-yellow uppercase tracking-wider">{title}</p>
      <div className="space-y-2">
        {buckets.length === 0 ? (
          <p className="text-sm text-canal-gray-muted italic">Aucune donnée.</p>
        ) : (
          buckets.map((bucket) => (
            <div key={bucket.id} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <p className="text-white font-medium truncate">{bucket.name}</p>
                <p className="text-canal-gray-muted tabular-nums">{bucket.predicted}/{bucket.total} · {bucket.participation_rate.toFixed(1)}%</p>
              </div>
              <div className="h-1.5 rounded-full bg-canal-gray-light/30 overflow-hidden">
                <div className="h-full bg-canal-yellow" style={{ width: progressWidth(bucket.participation_rate) }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
