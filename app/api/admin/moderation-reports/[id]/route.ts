import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser, isSocialAdmin } from "@/lib/social/profile";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentSocialUser();
  if (!isSocialAdmin(me)) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === "ignored" ? "ignored" : "reviewed";

  const admin = createAdminClient();
  const { error } = await admin.from("moderation_reports").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
