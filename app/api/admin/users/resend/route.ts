import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/data/users";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const adminClient = createAdminClient();

  // Vérifier que le caller est admin
  const { data: caller } = await adminClient
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();

  if (!caller?.is_active || !["admin", "super_admin"].includes(caller.role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });

  // Vérifier que l'utilisateur cible est dans l'allowlist
  const { data: target } = await adminClient
    .from("allowlist_users")
    .select("is_active")
    .eq("email", email)
    .single();

  if (!target?.is_active) {
    return NextResponse.json({ error: "Utilisateur inactif ou introuvable" }, { status: 400 });
  }

  // Générer un magic link via service_role
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${appUrl}/auth/callback` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(user.email, "resend_magic_link", email);

  // En production, Supabase envoie l'email automatiquement via generateLink
  // On retourne le lien pour debug uniquement en dev
  const isDev = process.env.NODE_ENV !== "production";
  return NextResponse.json({
    ok: true,
    ...(isDev && { link: data?.properties?.action_link }),
  });
}
