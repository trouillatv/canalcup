// POST /api/supporters/reactions — toggle d'une réaction emoji sur une photo.
// Body : { entry_id, emoji }. Re-tap = retire la réaction.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORTERS_REACTIONS } from "@/lib/supporters/access";
import { competitionLock } from "@/lib/event/status";

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  const emoji = typeof body?.emoji === "string" ? body.emoji : null;
  if (!entryId || !emoji || !(SUPPORTERS_REACTIONS as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: "Réaction invalide." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // La photo existe et est visible ?
  const { data: entry } = await admin
    .from("supporter_photo_entries")
    .select("id, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry || entry.status !== "approved") {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 400 });
  }

  // Toggle : si la réaction existe déjà → on la retire, sinon on l'ajoute.
  const { data: existing } = await admin
    .from("supporter_photo_reactions")
    .select("id")
    .eq("entry_id", entryId)
    .eq("user_id", me.id)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    await admin.from("supporter_photo_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ ok: true, active: false });
  }

  const { error } = await admin
    .from("supporter_photo_reactions")
    .insert({ entry_id: entryId, user_id: me.id, emoji });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, active: true });
}
