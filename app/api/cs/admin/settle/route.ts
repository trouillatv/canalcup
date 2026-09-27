// POST /api/cs/admin/settle
// Règle les predictions Architecture B (exact_score) en attente sur des
// events déjà terminés/annulés (voir lib/scoring/settle.ts, ADR 0005
// section 4). Déclenchement manuel uniquement dans ce lot — pas de cron.
//
// Protection : session Supabase réelle + allowlist admin (requireCsAdmin,
// lib/auth/cs-guard.ts), PAS un secret partagé — décision produit explicite
// pour éliminer NEXT_PUBLIC_ADMIN_SECRET du périmètre CANAL Sports. NE PAS
// confondre avec app/api/admin/settle/route.ts, la route legacy Canal Cup
// (jokers, scoring par match — produit différent, toujours protégée par
// x-admin-secret côté legacy, inchangée).
//
// Volontairement EXEMPTÉE du verrou global de clôture (voir EXEMPTS dans
// lib/event/lock-coverage.test.ts) : le settlement est une opération serveur
// de finalisation qui doit pouvoir s'exécuter même compétition fermée, pour
// solder les derniers events terminés. Cette exemption ne dispense pas de
// requireCsAdmin().

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireCsAdmin } from "@/lib/auth/cs-guard";
import { settlePendingPredictions, voidPredictionsForCancelledEvents } from "@/lib/scoring/settle";

export async function POST() {
  const supabase = await createClient();
  const admin = await requireCsAdmin(supabase);
  if (!admin.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: admin.status });
  }

  const settlement = await settlePendingPredictions();
  const voided = await voidPredictionsForCancelledEvents();

  return NextResponse.json({ ok: true, ...settlement, voided });
}
