// GET /api/admin/monitoring — agrège l'état de santé externe de l'app :
//   - Clés API (Gemini, API-Football) : présence + test live
//   - Quota API-Football : current/limit/day via /status
//   - Crons : 5 derniers runs par job depuis cron_runs
//   - Scraping joueurs : date du dernier fichier
//   - Comparatif data sources : API-Football vs TheSportsDB
//
// Protégé par isAdminRequest (auth Supabase + allowlist).

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { isAdminRequest } from "@/lib/auth/admin";
import { createAdminClient } from "@/lib/supabase/admin";

// Schedules définies dans vercel.json. À garder en sync (ou parser le
// fichier au runtime, mais c'est en .json donc statique).
const CRON_SCHEDULES: Record<string, { expr: string; label: string }> = {
  "morning-brief": { expr: "0 19 * * *", label: "tous les jours 6h NC (19h UTC)" },
  "sync-matches": { expr: "0 8 * * *", label: "tous les jours 19h NC (8h UTC)" },
  "daily-content": { expr: "30 12 * * *", label: "tous les jours 23h30 NC (12h30 UTC)" },
};

// Parser cron simple : ne supporte que 'M H * * *' (quotidien à H:M UTC).
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

async function checkGemini(): Promise<KeyStatus> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { state: "missing" };
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { method: "GET" }
    );
    if (res.ok) {
      const j = await res.json();
      return { state: "ok", detail: `${j.models?.length ?? 0} modèles dispos` };
    }
    return { state: "error", detail: `HTTP ${res.status}` };
  } catch (e) {
    return { state: "error", detail: e instanceof Error ? e.message : "fail" };
  }
}

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

async function checkApiFootball(): Promise<FootballStatus> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) return { key: { state: "missing" } };
  try {
    const res = await fetch("https://v3.football.api-sports.io/status", {
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

async function lastScrapingDate(): Promise<{ file: string; mtime: string } | null> {
  // L'enrichissement joueurs est un Python externe qui produit
  // docs/script/output/wc-teams-enriched*.json. On lit la date de
  // modification la plus récente.
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

  // Crons : pour chaque job — schedule, prochain run, dernier run,
  // état "à l'heure", erreurs récentes, et les 5 derniers runs.
  const KNOWN_JOBS = ["sync-matches", "morning-brief", "daily-content"];
  const nowMs = Date.now();
  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 3600 * 1000).toISOString();

  const crons: Record<string, {
    schedule: string;
    schedule_label: string;
    next_run: string | null;
    last_run: {
      started_at: string;
      finished_at: string | null;
      status: "running" | "success" | "failure";
      hours_ago: number;
    } | null;
    is_late: boolean; // dernier run > 25h ago pour un cron quotidien
    is_never: boolean; // jamais exécuté
    errors_last_7d: number;
    runs: unknown[]; // 5 derniers détaillés (compat existant)
  }> = {};

  for (const job of KNOWN_JOBS) {
    const meta = CRON_SCHEDULES[job] ?? { expr: "—", label: "inconnu" };
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

    crons[job] = {
      schedule: meta.expr,
      schedule_label: meta.label,
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
    };
  }

  // On charge les sondes externes EN PARALLÈLE avant de construire le
  // comparatif (qui en a besoin pour le scraping last_used).
  const [gemini, football, scraping] = await Promise.all([
    checkGemini(),
    checkApiFootball(),
    lastScrapingDate(),
  ]);

  // Dernière utilisation de chaque source data — pour le comparatif.
  // api-football et thesportsdb sont appelées par le cron sync-matches
  // (et accessoirement par les scripts manuels qui modifient matches).
  // On prend le max entre le dernier run sync-matches OK et le dernier
  // updated_at sur matches (cas script manuel récent).
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
      features: ["Live scores", "Compos", "Stats", "Events détaillés", "Notes joueur"],
      cost: "100 req/jour (Free)",
      latency: "≤ 30 sec",
      last_used: lastApifUsage,
    },
    thesportsdb: {
      enabled: true,
      features: ["Fixtures", "Scores finaux", "Timeline basique"],
      cost: "Illimité gratuit",
      latency: "5-15 min",
      last_used: lastSyncRun, // co-appelée par sync-matches
    },
    scraping_python: {
      enabled: true,
      features: ["Enrichissement joueurs WC2026 (multi-sources)"],
      cost: "Manuel — node docs/script/enrich_players.py",
      latency: "Ponctuel",
      last_used: scraping?.mtime ?? null,
    },
  };

  return NextResponse.json({
    ts: new Date().toISOString(),
    keys: {
      gemini,
      api_football: football.key,
    },
    quota: {
      api_football: football.quota ?? null,
    },
    crons,
    scraping_last: scraping,
    data_sources: dataSources,
    env: {
      mock_ai: process.env.MOCK_AI === "true",
      node_env: process.env.NODE_ENV,
    },
  });
}
