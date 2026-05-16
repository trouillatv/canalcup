// POST /api/admin/settle          → settle tous les matchs terminés non settlés
// POST /api/admin/settle?id=xxx   → settle un match précis (re-calcul forcé)
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settleMatch, settleAllFinished } from "@/services/scoring/settle";

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("id");

  if (matchId) {
    // Force re-settle a specific match (reset is_settled first)
    const supabase = createAdminClient();
    await supabase.from("matches").update({ is_settled: false }).eq("id", matchId);
    const result = await settleMatch(matchId);
    return NextResponse.json({ ok: true, match_id: matchId, ...result });
  }

  const result = await settleAllFinished();
  return NextResponse.json({ ok: true, ...result });
}
