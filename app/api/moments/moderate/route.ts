// POST /api/moments/moderate — gestion d'un Moment.
//  { action: "delete_moment", moment_id }   → l'AUTEUR ou un organisateur supprime
//  { action: "hide_moment",   moment_id }   → organisateur masque
//  { action: "delete_comment", comment_id } → l'AUTEUR du commentaire ou organisateur
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupportersOrganizer } from "@/lib/supporters/access";
import { competitionLock } from "@/lib/event/status";

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const role = await getCurrentUserRole();
  const isOrganizer = isSupportersOrganizer(role, user.email);

  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  switch (action) {
    case "delete_moment":
    case "hide_moment": {
      const momentId = typeof body?.moment_id === "string" ? body.moment_id : null;
      if (!momentId) return NextResponse.json({ error: "moment_id requis." }, { status: 400 });
      const { data: m } = await admin.from("canalcup_moments").select("id, user_id").eq("id", momentId).maybeSingle();
      if (!m) return NextResponse.json({ error: "Moment introuvable." }, { status: 404 });
      const isAuthor = m.user_id === me.id;
      if (!isOrganizer && !isAuthor) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
      if (action === "delete_moment") {
        // Réactions/commentaires partent en cascade (FK on delete cascade).
        await admin.from("canalcup_moments").delete().eq("id", momentId);
      } else {
        if (!isOrganizer) return NextResponse.json({ error: "Réservé aux organisateurs." }, { status: 403 });
        await admin.from("canalcup_moments").update({ status: "hidden" }).eq("id", momentId);
      }
      return NextResponse.json({ ok: true });
    }

    case "delete_comment": {
      const commentId = typeof body?.comment_id === "string" ? body.comment_id : null;
      if (!commentId) return NextResponse.json({ error: "comment_id requis." }, { status: 400 });
      const { data: c } = await admin.from("canalcup_moment_comments").select("id, user_id").eq("id", commentId).maybeSingle();
      if (!c) return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
      if (!isOrganizer && c.user_id !== me.id) return NextResponse.json({ error: "Action non autorisée." }, { status: 403 });
      await admin.from("canalcup_moment_comments").delete().eq("id", commentId);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
}
