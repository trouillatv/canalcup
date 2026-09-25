import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";
import { competitionLock } from "@/lib/event/status";
import { featureGuardResponse } from "@/lib/features/flags";

const ALLOWED_REACTIONS = ["🔥", "😂", "👏", "😱"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = featureGuardResponse("social");
  if (blocked) return blocked;
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const me = await getCurrentSocialUser();
  if (!me?.userId) return NextResponse.json({ error: "Profil introuvable" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const emoji = typeof body.emoji === "string" ? body.emoji : "";
  if (!ALLOWED_REACTIONS.includes(emoji)) {
    return NextResponse.json({ error: "Reaction invalide" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: message, error: msgError } = await admin
    .from("vestiaire_messages")
    .select("id, user_id, body, status")
    .eq("id", id)
    .maybeSingle();

  if (msgError) return NextResponse.json({ error: msgError.message }, { status: 500 });
  if (!message || message.status !== "visible") {
    return NextResponse.json({ error: "Message introuvable" }, { status: 404 });
  }
  if (message.user_id === me.userId) {
    return NextResponse.json({ error: "Pas d'auto-reaction sur son propre clash" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("vestiaire_message_reactions")
    .select("id")
    .eq("message_id", id)
    .eq("user_id", me.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await admin.from("vestiaire_message_reactions").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, active: false });
  }

  const { error: insertError } = await admin
    .from("vestiaire_message_reactions")
    .insert({ message_id: id, user_id: me.userId, emoji });

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  // Les réactions du Vestiaire sont PUREMENT SOCIALES : aucun point au score.
  // (Sinon un like de chat gonfle le pilier Animations via la catégorie
  // 'social', qui est réservée aux awards de la Journée Supporters.)
  return NextResponse.json({ ok: true, active: true });
}
