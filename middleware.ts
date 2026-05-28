import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Jamais protégé (dont /tv pour affichage salon commun et /p pour la
// route group (public) — version grand public, voir
// docs/PUBLIC_VERSION_ARCHITECTURE.md).
const PUBLIC_PATHS = ["/auth/callback", "/auth/hash-callback", "/auth/reset-password", "/tv", "/api/tv", "/api/admin/magic-link", "/api/admin/sync-matches", "/api/cron", "/api/babyfoot", "/p"];

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

// Assets statiques servis depuis /public — le matcher Next n'exclut que
// `_next/*`, `favicon.ico` et 2-3 entrées hard-codées, donc des fichiers
// type `/CDM-2026.jpeg` passent par le middleware et se font rediriger
// vers `/` pour les non-authentifiés (= l'image apparaît comme cassée).
// On bypass dès le début pour toutes les extensions classiques.
const ASSET_EXT_RE = /\.(jpe?g|png|gif|webp|svg|ico|css|woff2?|ttf|map|txt|xml|mp4|webm|mp3|pdf|json)$/i;
function isAssetPath(pathname: string): boolean {
  return ASSET_EXT_RE.test(pathname);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Assets statiques : on laisse Next servir tel quel, jamais d'auth.
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

  // ─── Trace "dernière connexion" RÉELLE (1×/jour/user) ────────────────────────
  // users.last_login_at n'était écrit qu'au clic du magic link, et auth.users.
  // last_sign_in_at ne bouge qu'au sign-in EXPLICITE (pas au refresh de session).
  // Conséquence : un user qui rouvre l'app jour après jour avec une session
  // active n'avait plus aucune date qui bouge — la page audit affichait donc
  // la date du dernier magic link, pas la dernière vraie connexion.
  // On bump ici à chaque requête authentifiée, throttlé via cookie (1 write/j
  // par utilisateur). Cookie httpOnly avec la date du jour comme valeur.
  const todayKey = new Date().toISOString().slice(0, 10);
  if (request.cookies.get("cc-llg")?.value !== todayKey) {
    await supabase
      .from("users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("auth_id", user.id);
    supabaseResponse.cookies.set("cc-llg", todayKey, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    });
  }

  // Connecté + route onboarding ou API → pas de vérification profile_completed
  if (isOnboarding(pathname) || isApiRoute(pathname)) {
    return supabaseResponse;
  }

  // Pages utilisateur → vérifier profil complété ET cohérent. L'équipe
  // n'est PLUS un prérequis : un user peut entrer dans l'app sans
  // équipe, il en aura besoin uniquement pour s'inscrire à une animation
  // ou pronostiquer (l'API renvoie alors un 400 explicite avec un lien
  // vers /profile pour rejoindre/créer une équipe).
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
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|icons|sw\\.js).*)",
  ],
};
