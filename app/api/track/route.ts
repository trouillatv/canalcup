import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/track — enregistre une vue de page (utilisateur connecté).
// Fire-and-forget côté client. On stocke le chemin BRUT ; la normalisation en
// templates se fait à la lecture (admin). Ignore les chemins admin/tv/api.
export async function POST(req: Request) {
  try {
    const { path } = await req.json();
    if (typeof path !== "string" || !path.startsWith("/")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (path.startsWith("/admin") || path.startsWith("/tv") || path.startsWith("/api")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });

    const admin = createAdminClient();
    const { data: profile } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();

    await admin.from("page_views").insert({
      user_id: profile?.id ?? null,
      path: path.slice(0, 300),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // ne jamais bloquer la nav
  }
}
