import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureAllowlisted } from "@/lib/auth/allowlist";

// Public paths
const PUBLIC_PATHS = [
  "/auth/callback",
  "/auth/hash-callback",
  "/auth/reset-password",
  "/tv",
  "/api/tv",
  "/api/admin/magic-link",
  "/api/admin/sync-matches",
  "/api/cron",
  "/api/babyfoot",
  "/p",
  "/offline",
  "/install",
];

// Auth required but not profile_completed (onboarding in progress)
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

const ASSET_EXT_RE = /\.(jpe?g|png|gif|webp|svg|ico|css|woff2?|ttf|map|txt|xml|mp4|webm|mp3|pdf|json)$/i;
function isAssetPath(pathname: string): boolean {
  return ASSET_EXT_RE.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAssetPath(pathname)) {
    return NextResponse.next({ request });
  }

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

  if (!user) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (pathname !== "/") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next({ request });
  }

  // Allowlist = serveur, pas UI.
  const allow = await ensureAllowlisted(user.email ?? "");
  if (!allow.ok) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: allow.reason }, { status: 403 });
    }
    return NextResponse.redirect(new URL(`/?error=${allow.error}`, request.url));
  }

  // Trace "dernière connexion" réelle (1x/jour/user).
  const todayKey = new Date().toISOString().slice(0, 10);
  if (request.cookies.get("cc-llg")?.value !== todayKey) {
    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("auth_id", user.id);
    supabaseResponse.cookies.set("cc-llg", todayKey, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (isOnboarding(pathname) || isApiRoute(pathname)) {
    return supabaseResponse;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed, service_id, football_level, display_name, name")
    .eq("auth_id", user.id)
    .single();

  const incomplete =
    !profile?.profile_completed ||
    !profile.service_id ||
    !profile.football_level ||
    !((profile.display_name ?? "").trim() || (profile.name ?? "").trim());

  if (incomplete) {
    return NextResponse.redirect(new URL("/onboarding?incomplete=1", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|sw\\.js).*)"],
};
