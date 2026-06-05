import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser, isSocialAdmin } from "@/lib/social/profile";

export async function GET() {
  const me = await getCurrentSocialUser();
  if (!isSocialAdmin(me)) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("moderation_reports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}
