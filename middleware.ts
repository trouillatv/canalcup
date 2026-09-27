import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureAllowlisted } from "@/lib/auth/allowlist";
import { ensureCanalSportsUser } from "@/lib/auth/cs-guard";

// Public paths
const PUBLIC_PATHS = [
  "/auth/callback",
  "/auth/hash-callback",
  "/auth/reset-password",
  "/tv",
  "/api/tv",
  "/api/auth/pre-check",
  "/api/admin/magic-link",
  "/api/admin/sync-matches",
  "/api/cron",
  "/api/babyfoot",
  "/p",
  "/offline",
  "/install",
];

// Auth required but not profile_completed (onboarding in progress)
const ONBOARDING_PATHS = ["/onboarding", "/cs/onboarding"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isOnboarding(pathname: string): boolean {
  return ONBOARDING_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

// CANAL Sports (Lot 3D-10) — n'a jamais dépendu, et ne dépend plus, de
// ensureAllowlisted()/allowlist_users (reliquat Canal Cup, voir
// docs/supabase-architecture-p2.md). Tout le reste de ce middleware
// (routes Canal Cup) reste inchangé.
function isCsPath(pathname: string): boolean {
  return pathname === "/cs" || pathname.startsWith("/cs/") || pathname.startsWith("/api/cs/");
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

  const isCs = isCsPath(pathname);

  // Autorisation = serveur, pas UI. CANAL Sports (isCs) utilise son propre
  // guard natif (public.users.auth_id) ; Canal Cup garde ensureAllowlisted.
  const allow = isCs
    ? await ensureCanalSportsUser(user.id, user.email ?? "")
    : await ensureAllowlisted(user.email ?? "");
  if (!allow.ok) {
    if (isApiRoute(pathname)) {
      return NextResponse.json({ error: allow.reason }, { status: 403 });
    }
    const errorTarget = isCs ? "/cs" : "/";
    return NextResponse.redirect(new URL(`${errorTarget}?error=${allow.error}`, request.url));
  }

  // Trace "dernière connexion" réelle (1x/jour/user) — colonne
  // last_login_at absente du users CANAL Sports, non applicable pour isCs.
  if (!isCs) {
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
  }

  if (isOnboarding(pathname) || isApiRoute(pathname)) {
    return supabaseResponse;
  }

  if (isCs) {
    const { data: csProfile } = await supabase
      .from("users")
      .select("profile_completed, display_name, name")
      .eq("auth_id", user.id)
      .single();

    const csIncomplete =
      !csProfile?.profile_completed ||
      !((csProfile.display_name ?? "").trim() || (csProfile.name ?? "").trim());

    if (csIncomplete) {
      return NextResponse.redirect(new URL("/cs/onboarding?incomplete=1", request.url));
    }

    return supabaseResponse;
  }

  const { data: profile } = await supabase
    .from("users")
    .select("profile_completed, service_id, display_name, name")
    .eq("auth_id", user.id)
    .single();

  // football_level n'est plus une condition structurelle de complétude du
  // profil (dette identifiée dans AUDIT-CANAL-SPORTS.md) : c'était une
  // préférence spécifique au foot, pas un champ générique multi-sport. Le
  // MVP CANAL Sports ne requiert que service + nom ; les préférences sport
  // viendront plus tard (cf. docs/adr/0001-multi-sport-data-model.md).
  const incomplete =
    !profile?.profile_completed ||
    !profile.service_id ||
    !((profile.display_name ?? "").trim() || (profile.name ?? "").trim());

  if (incomplete) {
    return NextResponse.redirect(new URL("/onboarding?incomplete=1", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|sw\\.js).*)"],
};
