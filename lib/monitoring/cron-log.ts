// Helper : wrap une cron-route Next pour logger automatiquement dans
// public.cron_runs (start, finish, status, error_message, meta optionnel).
// Utilisé par les 3 crons Vercel (morning-brief, sync-matches, daily-content)
// et tout cron futur.
//
// Usage type :
//   export async function GET(req: Request) {
//     return runCron("sync-matches", async () => {
//       // … le job
//       return { meta: { matches_synced: 7 } };
//     });
//   }

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface CronResult {
  meta?: Record<string, unknown>;
  /** Si défini, override le payload JSON renvoyé au cron caller. */
  responseBody?: unknown;
}

export async function runCron(
  job: string,
  fn: () => Promise<CronResult | void>
): Promise<Response> {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("cron_runs")
    .insert({ job, status: "running" })
    .select("id")
    .single();
  const runId = row?.id ?? null;
  const startMs = Date.now();

  try {
    const result = (await fn()) ?? {};
    if (runId) {
      await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "success",
          meta: { ...(result.meta ?? {}), duration_ms: Date.now() - startMs },
        })
        .eq("id", runId);
    }
    return NextResponse.json(result.responseBody ?? { ok: true, ...(result.meta ?? {}) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown error";
    if (runId) {
      await supabase
        .from("cron_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failure",
          error_message: message,
          meta: { duration_ms: Date.now() - startMs },
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
