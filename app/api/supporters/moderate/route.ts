// Modération a posteriori par les organisateurs (Marie & Vincent) — sans
// nécessiter le rôle admin global. Réservé aux organisateurs supporter.
//  POST { action: "hide_photo" | "restore_photo", entry_id }
//       { action: "delete_comment", comment_id }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupportersOrganizer } from "@/lib/supporters/access";
import { revokeAward, PARTICIPATION_LABEL, podiumLabel } from "@/lib/supporters/service";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole();
  if (!isSupportersOrganizer(role, user.email)) {
    return NextResponse.json({ error: "Réservé aux organisateurs." }, { status: 403 });
  }

  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;

  switch (action) {
    case "hide_photo": {
      const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
      if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });
      await admin.from("supporter_photo_entries").update({ status: "hidden" }).eq("id", entryId);
      // Retire les points liés (participation + podium éventuel).
      await revokeAward(admin, { sourceId: entryId, label: PARTICIPATION_LABEL });
      for (const r of [1, 2, 3]) await revokeAward(admin, { sourceId: entryId, label: podiumLabel(r) });
      await admin
        .from("supporter_photo_entries")
        .update({ participation_awarded: false, podium_rank: null })
        .eq("id", entryId);
      return NextResponse.json({ ok: true });
    }

    case "restore_photo": {
      const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
      if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });
      await admin
        .from("supporter_photo_entries")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", entryId);
      return NextResponse.json({ ok: true });
    }

    case "delete_comment": {
      const commentId = typeof body?.comment_id === "string" ? body.comment_id : null;
      if (!commentId) return NextResponse.json({ error: "comment_id requis." }, { status: 400 });
      await admin.from("supporter_photo_comments").delete().eq("id", commentId);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
}
