import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";

const ALLOWED_REACTIONS = ["🔥", "😂", "👏", "😱"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    await admin.from("score_events").delete().eq("source_type", "vote").eq("source_id", existing.id);
    const { error } = await admin.from("vestiaire_message_reactions").delete().eq("id", existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, active: false });
  }

  const { data: reaction, error: insertError } = await admin
    .from("vestiaire_message_reactions")
    .insert({ message_id: id, user_id: me.userId, emoji })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  const { data: author } = message.user_id
    ? await admin.from("users").select("id, team_id, display_name, name").eq("id", message.user_id).maybeSingle()
    : { data: null };

  if (author?.team_id) {
    await admin.from("score_events").insert({
      team_id: author.team_id,
      user_id: author.id,
      category: "social",
      source_type: "vote",
      source_id: reaction.id,
      raw_points: 1,
      label: "Reaction Vestiaire",
      description: `${emoji} recu sur un message du Vestiaire`,
    });
  }

  return NextResponse.json({ ok: true, active: true });
}
