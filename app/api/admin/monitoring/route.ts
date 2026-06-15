// GET /api/admin/monitoring â€” agrÃ¨ge l'Ã©tat de santÃ© externe de l'app :
//   - ClÃ©s API (Gemini, API-Football) : prÃ©sence + test live
//   - Quota API-Football : current/limit/day via /status
//   - Crons : 5 derniers runs par job depuis cron_runs
//   - Scraping joueurs : date du dernier fichier
//   - Comparatif data sources : API-Football
//
// ProtÃ©gÃ© par isAdminRequest (auth Supabase + allowlist).

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAdminRequest } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLiveSyncBudget } from "@/services/football/sync";

// Schedules dÃ©finies dans vercel.json. Ã€ garder en sync (ou parser le
// fichier au runtime, mais c'est en .json donc statique).
const CRON_SCHEDULES: Record<string, { expr: string; label: string; what: string }> = {
  "morning-brief": {
    expr: "0 19 * * *",
    label: "tous les jours 6h NC (19h UTC)",
    what:
      "GÃ©nÃ¨re la Matinale du jour (Gemini ou MOCK) Ã  partir des scores de la veille + classement + match du soir. Persiste 1 ligne dans morning_briefs, diffuse 1 courrier inbox 'matinale' Ã  chaque utilisateur. Idempotent (skip si dÃ©jÃ  gÃ©nÃ©rÃ©e).",
  },
  "sync-matches": {
    expr: "0 8 * * *",
    label: "tous les jours 19h NC (8h UTC)",
    what:
      "Sync les fixtures WC2026 et les scores live depuis API-Football. Met Ã  jour standings, dÃ©clenche le 'settle' des matchs FT (calcul des points pronostics finalisÃ©s).",
  },
  "daily-content": {
    expr: "30 12 * * *",
    label: "tous les jours 23h30 NC (12h30 UTC)",
    what:
      "GÃ©nÃ¨re 3 contenus IA aprÃ¨s les matchs du soir : fun fact, mot du coach, wall of shame. Diffuse 1 courrier inbox 'roast' Ã  chaque utilisateur (anti-doublon journalier). Tracke le coÃ»t Gemini.",
  },
};

// Parser cron simple : ne supporte que 'M H * * *' (quotidien Ã  H:M UTC).
// Suffisant pour tous nos crons actuels.
function parseNextRun(expr: string): Date | null {
  const parts = expr.split(/\s+/);
  if (parts.length < 5) return null;
  const m = parseInt(parts[0], 10);
  const h = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(h)) return null;
  if (parts[2] !== "*" || parts[3] !== "*" || parts[4] !== "*") return null;
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m, 0)
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

type KeyStatus =
  | { state: "ok"; detail?: string }
  | { state: "missing" }
  | { state: "error"; detail: string };

// Cache process-local 10 sec : les sondes externes (Gemini /models +
// API-Football /status) sont CHÃˆRES (latence 500ms-2s). Si l'admin
// laisse le toggle auto-refresh 30s actif, on ne tape PAS les API Ã 
// chaque tick â€” un refresh rÃ©cent vaut une vÃ©ritÃ© partagÃ©e.
const probeCache = new Map<string, { ts: number; value: unknown }>();
const PROBE_TTL_MS = 10_000;

function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = probeCache.get(key);
  if (hit && Date.now() - hit.ts < PROBE_TTL_MS) {
    return Promise.resolve(hit.value as T);
  }
  return fn().then((v) => {
    probeCache.set(key, { ts: Date.now(), value: v });
    return v;
  });
}

// Timeout 2 sec sur les sondes externes pour Ã©viter qu'un endpoint
// fantÃ´me bloque le rendu de la page entiÃ¨re.
async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 2000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkGeminiUncached(): Promise<KeyStatus> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { state: "missing" };
  try {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { method: "GET" }
    );
    if (res.ok) {
      const j = await res.json();
      return { state: "ok", detail: `${j.models?.length ?? 0} modÃ¨les dispos` };
    }
    return { state: "error", detail: `HTTP ${res.status}` };
  } catch (e) {
    return { state: "error", detail: e instanceof Error ? e.message : "fail" };
  }
}
const checkGemini = () => cached("gemini", checkGeminiUncached);

interface FootballStatus {
  key: KeyStatus;
  quota?: {
    current: number;
    limit_day: number;
    remaining: number;
    plan?: string;
    requests_window?: string;
  };
}

async function checkApiFootballUncached(): Promise<FootballStatus> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { key: { state: "missing" } };
  try {
    const res = await fetchWithTimeout("https://v3.football.api-sports.io/status", {
      headers: { "x-apisports-key": key },
    });
    if (!res.ok) {
      return { key: { state: "error", detail: `HTTP ${res.status}` } };
    }
    const j = await res.json();
    const r = j.response;
    const current = r?.requests?.current ?? 0;
    const limit_day = r?.requests?.limit_day ?? 100;
    return {
      key: { state: "ok", detail: r?.account?.email ?? "" },
      quota: {
        current,
        limit_day,
        remaining: Math.max(0, limit_day - current),
        plan: r?.subscription?.plan ?? "Free",
      },
    };
  } catch (e) {
    return { key: { state: "error", detail: e instanceof Error ? e.message : "fail" } };
  }
}
const checkApiFootball = () => cached<FootballStatus>("apif", checkApiFootballUncached);

async function lastScrapingDate(): Promise<{ file: string; mtime: string } | null> {
  // L'enrichissement joueurs est un Python externe qui produit
  // docs/script/output/wc-teams-enriched*.json. On lit la date de
  // modification la plus rÃ©cente.
  try {
    const dir = path.join(process.cwd(), "docs", "script", "output");
    if (!fs.existsSync(dir)) return null;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    if (files.length === 0) return null;
    let bestFile = "";
    let bestMtime = 0;
    for (const f of files) {
      const st = fs.statSync(path.join(dir, f));
      if (st.mtimeMs > bestMtime) {
        bestMtime = st.mtimeMs;
        bestFile = f;
      }
    }
    return { file: bestFile, mtime: new Date(bestMtime).toISOString() };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Crons : pour chaque job â€” schedule, prochain run, dernier run,
  // Ã©tat "Ã  l'heure", erreurs rÃ©centes, et les 5 derniers runs.
  const KNOWN_JOBS = ["sync-matches", "morning-brief", "daily-content"];
  const nowMs = Date.now();
  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString();

  const crons: Record<string, {
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
    runs: unknown[];
    // Conso meta : dernier run + cumul depuis toujours.
    consumption: {
      last: { gemini_cost_eur?: number; apif_calls?: number };
      total: { gemini_cost_eur: number; apif_calls: number; runs_count: number };
    };
  }> = {};

  for (const job of KNOWN_JOBS) {
    const meta = CRON_SCHEDULES[job] ?? { expr: "â€”", label: "inconnu", what: "" };
    const nextRun = parseNextRun(meta.expr);

    const { data: recentRuns } = await supabase
      .from("cron_runs")
      .select("id, started_at, finished_at, status, error_message, meta")
      .eq("job", job)
      .order("started_at", { ascending: false })
      .limit(5);

    const last = recentRuns?.[0] ?? null;
    const hoursAgo = last ? (nowMs - new Date(last.started_at).getTime()) / 3600_000 : null;

    const { count: errorsCount } = await supabase
      .from("cron_runs")
      .select("*", { count: "exact", head: true })
      .eq("job", job)
      .eq("status", "failure")
      .gte("started_at", sevenDaysAgo);

    // Cumul depuis le dÃ©but : on parcourt TOUS les runs success de ce job
    // et on somme les champs meta.gemini_cost_eur et meta.apif_calls.
    const { data: allRuns } = await supabase
      .from("cron_runs")
      .select("meta")
      .eq("job", job)
      .eq("status", "success");
    let totalGemini = 0;
    let totalApifCalls = 0;
    for (const r of allRuns ?? []) {
      const m = (r.meta ?? {}) as Record<string, unknown>;
      const g = m.gemini_cost_eur;
      const a = m.apif_calls;
      if (typeof g === "number") totalGemini += g;
      if (typeof a === "number") totalApifCalls += a;
    }
    const lastMeta = (last?.meta ?? {}) as Record<string, unknown>;

    crons[job] = {
      schedule: meta.expr,
      schedule_label: meta.label,
      what: meta.what,
      next_run: nextRun?.toISOString() ?? null,
      last_run: last
        ? {
            started_at: last.started_at,
            finished_at: last.finished_at,
            status: last.status as "running" | "success" | "failure",
            hours_ago: Math.round((hoursAgo ?? 0) * 10) / 10,
          }
        : null,
      is_late: hoursAgo !== null && hoursAgo > 25,
      is_never: last === null,
      errors_last_7d: errorsCount ?? 0,
      runs: recentRuns ?? [],
      consumption: {
        last: {
          gemini_cost_eur: typeof lastMeta.gemini_cost_eur === "number" ? lastMeta.gemini_cost_eur : undefined,
          apif_calls: typeof lastMeta.apif_calls === "number" ? lastMeta.apif_calls : undefined,
        },
        total: {
          gemini_cost_eur: Math.round(totalGemini * 10000) / 10000,
          apif_calls: totalApifCalls,
          runs_count: (allRuns ?? []).length,
        },
      },
    };
  }

  // On charge les sondes externes EN PARALLÃˆLE avant de construire le
  // comparatif (qui en a besoin pour le scraping last_used).
  const [gemini, football, scraping, resyncBudget] = await Promise.all([
    checkGemini(),
    checkApiFootball(),
    lastScrapingDate(),
    getLiveSyncBudget(supabase).catch(() => null),
  ]);

  // DerniÃ¨re utilisation de chaque source data â€” pour le comparatif.
  // API-Football est la source unique. On prend le max entre le dernier run
  // sync-matches OK et le dernier updated_at sur matches (cas script manuel
  // récent).
  const lastSyncRun = crons["sync-matches"]?.last_run?.started_at ?? null;
  const { data: lastMatchTouched } = await supabase
    .from("matches")
    .select("updated_at")
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const lastApifUsage = (() => {
    const dates = [lastSyncRun, lastMatchTouched?.updated_at].filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  })();

  // Comparatif des sources
  const dataSources = {
    "api-football": {
      enabled: !!process.env.API_FOOTBALL_KEY,
      features: ["Live scores", "Compos", "Stats", "Events dÃ©taillÃ©s", "Notes joueur"],
      cost: "100 req/jour (Free)",
      latency: "â‰¤ 30 sec",
      last_used: lastApifUsage,
    },


    scraping_python: {
      enabled: true,
      features: ["Enrichissement joueurs WC2026 (multi-sources)"],
      cost: "Manuel â€” node docs/script/enrich_players.py",
      latency: "Ponctuel",
      last_used: scraping?.mtime ?? null,
    },
  };

  // Total agrÃ©gÃ© tous crons confondus
  const grandTotal = Object.values(crons).reduce(
    (acc, c) => ({
      gemini_cost_eur: acc.gemini_cost_eur + c.consumption.total.gemini_cost_eur,
      apif_calls: acc.apif_calls + c.consumption.total.apif_calls,
      runs_count: acc.runs_count + c.consumption.total.runs_count,
    }),
    { gemini_cost_eur: 0, apif_calls: 0, runs_count: 0 }
  );

  return NextResponse.json({
    ts: new Date().toISOString(),
    keys: {
      gemini,
      api_football: football.key,
    },
    consumption_total: {
      gemini_cost_eur: Math.round(grandTotal.gemini_cost_eur * 10000) / 10000,
      apif_calls: grandTotal.apif_calls,
      runs_count: grandTotal.runs_count,
    },
    quota: {
      api_football: football.quota ?? null,
    },
    resync_budget: resyncBudget,
    crons,
    scraping_last: scraping,
    data_sources: dataSources,
    env: {
      mock_ai: process.env.MOCK_AI === "true",
      node_env: process.env.NODE_ENV,
    },
  });
}






