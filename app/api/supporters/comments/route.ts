// Commentaires sous une photo supporter (chambrage bon enfant).
//  GET  ?entry_id=…  → liste des commentaires d'une photo.
//  POST { entry_id, body } → ajoute un commentaire + push au binôme auteur.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUser } from "@/lib/push";
import { SUPPORTERS_PUSH_ENABLED } from "@/lib/supporters/access";
import { competitionLock } from "@/lib/event/status";

const MAX_LEN = 280;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const entryId = new URL(req.url).searchParams.get("entry_id");
  if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("supporter_photo_comments")
    .select("id, user_id, display_name, body, created_at")
    .eq("entry_id", entryId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ comments: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, MAX_LEN) : "";
  if (!entryId || !text) return NextResponse.json({ error: "Commentaire vide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, display_name, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // La photo existe et est visible ?
  const { data: entry } = await admin
    .from("supporter_photo_entries")
    .select("id, team_id, title, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry || entry.status !== "approved") {
    return NextResponse.json({ error: "Photo introuvable." }, { status: 400 });
  }

  const displayName = me.display_name || me.name || "Supporter";
  const { data: inserted, error } = await admin
    .from("supporter_photo_comments")
    .insert({ entry_id: entryId, user_id: me.id, display_name: displayName, body: text })
    .select("id, user_id, display_name, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 🔔 Push au binôme propriétaire de la photo (sauf l'auteur du commentaire).
  // Préparé mais inactif tant que SUPPORTERS_PUSH_ENABLED est à false.
  if (SUPPORTERS_PUSH_ENABLED) void (async () => {
    const { data: members } = await admin
      .from("users")
      .select("id, auth_id")
      .eq("team_id", entry.team_id);
    const targets = (members ?? []).filter((m) => m.id !== me.id && m.auth_id);
    const label = entry.title ? `« ${entry.title} »` : "votre photo";
    for (const m of targets) {
      await sendPushToUser(m.auth_id as string, {
        title: "💬 Nouveau commentaire sur votre photo",
        body: `${displayName} : ${text.slice(0, 90)}`,
        url: "/supporters",
      });
    }
    void label;
  })().catch((e) => console.error("[supporters/comments] push failed", e));

  return NextResponse.json({ ok: true, comment: inserted });
}
