import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails } from "@/lib/data/roles";
import { normalizePath, KNOWN_ROUTES } from "@/lib/analytics/normalize-path";

async function callerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("allowlist_users").select("role, is_active").eq("email", user.email).single();
  return !!data?.is_active && ["admin", "super_admin", "event_admin"].includes(data.role ?? "");
}

type ViewRow = { user_id: string | null; path: string; created_at: string };

export async function GET(req: Request) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const days = Math.min(365, Math.max(1, parseInt(new URL(req.url).searchParams.get("days") ?? "30", 10) || 30));
  const admin = createAdminClient();
  const sinceMs = Date.now() - days * 86400_000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Vues de pages (fenêtre) — paginé.
  const views: ViewRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await admin.from("page_views").select("user_id, path, created_at").gte("created_at", sinceIso).range(from, from + 999);
    if (!data?.length) break;
    views.push(...(data as ViewRow[]));
    if (data.length < 1000) break;
  }

  // Utilisateurs + admins exclus.
  const [{ data: usersRaw }, adminEmails] = await Promise.all([
    admin.from("users").select("id, display_name, name, email, last_login_at, created_at"),
    getAdminEmails(),
  ]);
  type U = { id: string; display_name: string | null; name: string | null; email: string | null; last_login_at: string | null; created_at: string | null };
  const users = (usersRaw ?? []) as U[];
  const isAdmin = (e: string | null) => adminEmails.has((e ?? "").toLowerCase());

  // ── Pages : agrégat par template ───────────────────────────────────────────
  const byPath = new Map<string, { views: number; users: Set<string>; last: string }>();
  const viewsByUser = new Map<string, number>();
  for (const v of views) {
    const tpl = normalizePath(v.path);
    const e = byPath.get(tpl) ?? { views: 0, users: new Set<string>(), last: v.created_at };
    e.views++;
    if (v.user_id) e.users.add(v.user_id);
    if (v.created_at > e.last) e.last = v.created_at;
    byPath.set(tpl, e);
    if (v.user_id) viewsByUser.set(v.user_id, (viewsByUser.get(v.user_id) ?? 0) + 1);
  }
  const pages = [...byPath.entries()]
    .map(([path, e]) => ({ path, views: e.views, users: e.users.size, last: e.last }))
    .sort((a, b) => b.views - a.views);

  const seen = new Set(pages.map((p) => p.path));
  const unused = KNOWN_ROUTES.filter((r) => !seen.has(r));

  // ── Connexions / logins ────────────────────────────────────────────────────
  const cut = (d: number) => Date.now() - d * 86400_000;
  const competitors = users.filter((u) => !isAdmin(u.email));
  const loggedAt = (u: U) => (u.last_login_at ? new Date(u.last_login_at).getTime() : 0);
  const logins = {
    totalUsers: competitors.length,
    neverLoggedIn: competitors.filter((u) => !u.last_login_at).length,
    active24h: competitors.filter((u) => loggedAt(u) >= cut(1)).length,
    active7d: competitors.filter((u) => loggedAt(u) >= cut(7)).length,
    active30d: competitors.filter((u) => loggedAt(u) >= cut(30)).length,
  };

  // ── Par utilisateur ─────────────────────────────────────────────────────────
  const perUser = competitors
    .map((u) => ({
      id: u.id,
      name: (u.display_name ?? u.name ?? "Joueur")?.trim() || "Joueur",
      email: u.email,
      last_login_at: u.last_login_at,
      views: viewsByUser.get(u.id) ?? 0,
    }))
    .sort((a, b) => (b.last_login_at ? new Date(b.last_login_at).getTime() : 0) - (a.last_login_at ? new Date(a.last_login_at).getTime() : 0));

  return NextResponse.json(
    { days, totalViews: views.length, pages, unused, logins, users: perUser },
    { headers: { "Cache-Control": "no-store" } }
  );
}
