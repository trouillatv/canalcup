// GET /api/tv/flash — retourne les flashes actifs (non expirés)
// Pollé toutes les 10s par le TV mode

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("tv_flash_events")
    .select("id, type, title, subtitle, emoji, created_at, expires_at")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json(
    { flashes: data ?? [] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
