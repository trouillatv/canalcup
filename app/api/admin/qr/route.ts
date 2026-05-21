// GET /api/admin/qr?slug=welcome — retourne le compteur d'un slug donné.
// Utilisé par /admin/qr pour afficher le nombre de scans.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "welcome";

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("qr_counters")
    .select("slug, count, last_scan_at, created_at")
    .eq("slug", slug)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    slug,
    count: data?.count ?? 0,
    last_scan_at: data?.last_scan_at ?? null,
    created_at: data?.created_at ?? null,
  });
}
