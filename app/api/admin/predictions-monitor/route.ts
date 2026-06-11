import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMatchPredictionMonitor } from "@/lib/data/predictions-monitor";

async function canAccessMonitor(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;

  const admin = createAdminClient();
  const { data } = await admin
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();

  return !!data?.is_active && ["admin", "event_admin", "super_admin"].includes(data.role);
}

export async function GET(request: NextRequest) {
  if (!(await canAccessMonitor())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matchId = request.nextUrl.searchParams.get("matchId");
  const data = await getMatchPredictionMonitor(matchId);
  if (!data) {
    return NextResponse.json({ error: "No matches found" }, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
