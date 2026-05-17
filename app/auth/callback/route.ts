import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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

  // Vérifier l'allowlist
  const { data: allowed } = await supabase
    .from("allowlist_users")
    .select("is_active")
    .eq("email", user.email)
    .single();

  if (!allowed?.is_active) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=not_allowed`);
  }

  // Mettre à jour last_login_at
  await supabase
    .from("users")
    .update({ last_login_at: new Date().toISOString() })
    .eq("auth_id", user.id);

  // Vérifier si le profil est complété
  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed")
    .eq("auth_id", user.id)
    .single();

  if (!profile?.profile_completed) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${redirectTo}`);
}
