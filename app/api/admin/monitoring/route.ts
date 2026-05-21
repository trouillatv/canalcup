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

  // Crons : 5 derniers runs par job
  const KNOWN_JOBS = ["sync-matches", "morning-brief", "daily-content"];
  const crons: Record<string, unknown[]> = {};
  for (const job of KNOWN_JOBS) {
    const { data } = await supabase
      .from("cron_runs")
      .select("id, started_at, finished_at, status, error_message, meta")
      .eq("job", job)
      .order("started_at", { ascending: false })
      .limit(5);
    crons[job] = data ?? [];
  }

  // Comparatif des sources
  const dataSources = {
    "api-football": {
      enabled: !!process.env.API_FOOTBALL_KEY,
      features: ["Live scores", "Compos", "Stats", "Events détaillés", "Notes joueur"],
      cost: "100 req/jour (Free)",
      latency: "≤ 30 sec",
    },
    thesportsdb: {
      enabled: true,
      features: ["Fixtures", "Scores finaux", "Timeline basique"],
      cost: "Illimité gratuit",
      latency: "5-15 min",
    },
    scraping_python: {
      enabled: true,
      features: ["Enrichissement joueurs WC2026 (multi-sources)"],
      cost: "Manuel — node docs/script/enrich_players.py",
      latency: "Ponctuel",
    },
  };

  const [gemini, football, scraping] = await Promise.all([
    checkGemini(),
    checkApiFootball(),
    lastScrapingDate(),
  ]);

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
