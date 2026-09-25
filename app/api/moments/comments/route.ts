// POST /api/moments/comments — commente un Moment. Body : { moment_id, body }.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { competitionLock } from "@/lib/event/status";
import { featureGuardResponse } from "@/lib/features/flags";

const MAX_LEN = 280;

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
  const text = typeof body?.body === "string" ? body.body.trim().slice(0, MAX_LEN) : "";
  if (!momentId || !text) return NextResponse.json({ error: "Commentaire vide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id, display_name, name").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const { data: moment } = await admin.from("canalcup_moments").select("id, status").eq("id", momentId).maybeSingle();
  if (!moment || moment.status !== "visible") return NextResponse.json({ error: "Moment introuvable." }, { status: 400 });

  const displayName = me.display_name || me.name || "Un joueur";
  const { data: inserted, error } = await admin
    .from("canalcup_moment_comments")
    .insert({ moment_id: momentId, user_id: me.id, display_name: displayName, body: text })
    .select("id, user_id, display_name, body, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, comment: inserted });
}
