// POST /api/moments/reactions — toggle d'une réaction emoji sur un Moment.
// Body : { moment_id, emoji }. Re-tap = retire.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOMENT_REACTIONS } from "@/lib/moments/categories";
import { competitionLock } from "@/lib/event/status";
import { featureGuardResponse } from "@/lib/features/flags";

export async function POST(req: Request) {
  const blocked = featureGuardResponse("social");
  if (blocked) return blocked;
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const momentId = typeof body?.moment_id === "string" ? body.moment_id : null;
  const emoji = typeof body?.emoji === "string" ? body.emoji : null;
  if (!momentId || !emoji || !(MOMENT_REACTIONS as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: "Réaction invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const { data: moment } = await admin.from("canalcup_moments").select("id, status").eq("id", momentId).maybeSingle();
  if (!moment || moment.status !== "visible") return NextResponse.json({ error: "Moment introuvable." }, { status: 400 });

  const { data: existing } = await admin
    .from("canalcup_moment_reactions")
    .select("id")
    .eq("moment_id", momentId)
    .eq("user_id", me.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await admin.from("canalcup_moment_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, active: false });
  }
  const { error } = await admin.from("canalcup_moment_reactions").insert({ moment_id: momentId, user_id: me.id, emoji });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, active: true });
}
