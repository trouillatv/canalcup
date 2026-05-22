import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/feedback — un utilisateur connecté envoie un retour / signale un
// souci. On rattache son identité (user_id, email, pseudo) côté serveur.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" ? body.page.slice(0, 300) : null;
  if (message.length < 3) {
    return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "Message trop long (2000 max)" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("id, display_name, name")
    .eq("auth_id", user.id)
    .maybeSingle();

  const { error } = await admin.from("feedback").insert({
    user_id: profile?.id ?? null,
    email: user.email,
    display_name: profile?.display_name ?? profile?.name ?? null,
    message,
    page,
    status: "new",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
