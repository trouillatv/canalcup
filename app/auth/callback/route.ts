// /auth/callback — point d'entrée APRÈS clic sur lien email
// (confirmation signup OU magic link). Échange le code Supabase
// contre une session, applique l'allowlist (avec auto-allowlist par
// domaine via le helper unique), puis route vers /onboarding ou
// /home selon que le profil est complété.

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureAllowlisted } from "@/lib/auth/allowlist";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirectTo") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`);
  }

  // Allowlist : voie unique partagée avec /api/auth/self-allowlist.
  // Auto-insertion si l'email est sur un domaine autorisé.
  const allow = await ensureAllowlisted(user.email);
  if (!allow.ok) {
    await supabase.auth.signOut();
    const code = allow.error === "disabled" ? "disabled" : "not_allowed";
    return NextResponse.redirect(`${origin}/?error=${code}`);
  }

  // Met à jour last_login_at (la row peut ne pas exister pour un
  // tout nouveau signup — c'est l'onboarding qui crée la row via
  // UPSERT, donc on ne plante pas ici si 0 ligne touchée).
  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("auth_id", user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed")
    .eq("auth_id", user.id)
    .maybeSingle();

  if (!profile?.profile_completed) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
