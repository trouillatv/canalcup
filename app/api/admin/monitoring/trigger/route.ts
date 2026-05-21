// POST /api/admin/monitoring/trigger — lance manuellement un cron
// avec le bon header Authorization (CRON_SECRET injecté côté serveur).
// Utile pour tester qu'un cron marche sans attendre son horaire Vercel.

import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/auth/admin";

const ALLOWED_JOBS = new Set(["sync-matches", "morning-brief", "daily-content"]);

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const job = typeof body.job === "string" ? body.job : "";
  if (!ALLOWED_JOBS.has(job)) {
    return NextResponse.json({ error: "job non reconnu" }, { status: 400 });
  }

  // En prod, les routes /api/cron/* attendent un header Bearer
  // CRON_SECRET (auto-injecté par Vercel pour les crons schedulés).
  // En manuel, on l'injecte nous-mêmes côté serveur.
  const url = new URL(req.url);
  const target = `${url.protocol}//${url.host}/api/cron/${job}`;
  const secret = process.env.CRON_SECRET ?? "";

  try {
    const res = await fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}` },
      // Pas de cache, on veut un vrai run.
      cache: "no-store",
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return NextResponse.json(
      { ok: res.ok, status: res.status, response: data },
      { status: res.ok ? 200 : 500 }
    );
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "fetch failed" },
      { status: 500 }
    );
  }
}
