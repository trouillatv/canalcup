import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser, isSocialAdmin } from "@/lib/social/profile";
import { competitionLock } from "@/lib/event/status";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const me = await getCurrentSocialUser();
  if (!isSocialAdmin(me)) return NextResponse.json({ error: "Acces refuse" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = body.status === "visible" ? "visible" : "hidden";

  const admin = createAdminClient();
  const { error } = await admin
    .from("feed_posts")
    .update({
      status,
      hidden_at: status === "hidden" ? new Date().toISOString() : null,
      hidden_by_email: status === "hidden" ? me?.email ?? null : null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
