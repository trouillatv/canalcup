import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Jamais protégé (dont /tv pour affichage salon commun)
const PUBLIC_PATHS = ["/auth/callback", "/auth/hash-callback", "/auth/reset-password", "/tv", "/api/tv", "/api/admin/magic-link", "/api/admin/sync-matches", "/api/cron", "/api/babyfoot"];

// Auth requise mais pas profile_completed (onboarding en cours)
const ONBOARDING_PATHS = ["/onboarding"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isOnboarding(pathname: string): boolean {
  return ONBOARDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Non connecté
  if (!user) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Redirige vers "/" (réception magic link) sauf si déjà là
    if (pathname !== "/") {
      const home = new URL("/", request.url);
      return NextResponse.redirect(home);
    }
    return NextResponse.next({ request });
  }

  // Connecté + route onboarding ou API → pas de vérification profile_completed
  if (isOnboarding(pathname) || isApiRoute(pathname)) {
    return supabaseResponse;
  }

  // Pages utilisateur → vérifier profil complété
  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed")
    .eq("auth_id", user.id)
    .single();

  if (!profile?.profile_completed) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|sw\\.js).*)",
  ],
};
