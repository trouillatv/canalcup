// /auth/callback — point d'entrée APRÈS clic sur lien email
// (confirmation signup OU magic link), PARTAGÉ par Canal Cup et CANAL
// Sports (aucun paramètre ne les distingue à ce stade). Échange le code
// Supabase contre une session, puis fork sur l'email authentifié
// (Lot 3D-10) : email déjà connu dans public.users -> identité CANAL
// Sports (ensureCanalSportsUser, /cs/onboarding ou /cs) ; sinon,
// comportement Canal Cup inchangé (ensureAllowlisted, /onboarding).

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureAllowlisted } from "@/lib/auth/allowlist";
import { ensureCanalSportsUser } from "@/lib/auth/cs-guard";

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

  // Fork CANAL Sports (Lot 3D-10) : l'email authentifié existe déjà dans
  // public.users -> identité CANAL Sports, jamais ensureAllowlisted.
  const { data: csUser } = await supabase
    .from("users")
    .select("id")
    .ilike("email", user.email)
    .maybeSingle();

  if (csUser) {
    const allow = await ensureCanalSportsUser(user.id, user.email);
    if (!allow.ok) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/cs?error=${allow.error}`);
    }

    const { data: csProfile } = await supabase
      .from("users")
      .select("profile_completed")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (!csProfile?.profile_completed) {
      return NextResponse.redirect(`${origin}/cs/onboarding`);
    }

    return NextResponse.redirect(`${origin}${redirectTo === "/" ? "/cs" : redirectTo}`);
  }

  // Canal Cup — comportement inchangé.
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
