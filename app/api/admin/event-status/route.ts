// Bascule « Canal Cup ouverte / terminée » — réservé aux organisateurs.
//
// Écrit `app_settings.event_status` et invalide immédiatement le cache local.
// Les autres instances serverless rattrapent en ≤ 30 s (TTL du cache) : la
// clôture n'est pas une opération à la seconde près.
//
// Réversible sans effet de bord : la clôture ne recalcule RIEN, elle masque et
// verrouille. Rouvrir remet tout comme avant.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import {
  EVENT_STATUS_KEY,
  getEventStatus,
  invalidateEventStatusCache,
} from "@/lib/event/status";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ status: await getEventStatus() });
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (status !== "open" && status !== "closed") {
    return NextResponse.json(
      { error: "status doit valoir 'open' ou 'closed'" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("app_settings")
    .upsert({ key: EVENT_STATUS_KEY, value: status, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  invalidateEventStatusCache();
  return NextResponse.json({ status });
}
