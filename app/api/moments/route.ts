// GET /api/moments — fil du Mur « Moments CanalCup » : photos + réactions +
// commentaires. Optionnel ?category=match|supporters|... pour filtrer.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupportersOrganizer } from "@/lib/supporters/access";
import { MOMENT_CATEGORY_KEYS } from "@/lib/moments/categories";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const role = await getCurrentUserRole();
  const isOrganizer = isSupportersOrganizer(role, user.email);

  const catParam = new URL(req.url).searchParams.get("category");
  const category = catParam && MOMENT_CATEGORY_KEYS.includes(catParam) ? catParam : null;

  let q = admin
    .from("canalcup_moments")
    .select("id, user_id, author_name, title, category, photo_url, media_type, created_at")
    .eq("status", "visible")
    .order("created_at", { ascending: false });
  if (category) q = q.eq("category", category);
  const { data: moments } = await q;

  const ids = (moments ?? []).map((m) => m.id);
  const reactByMoment = new Map<string, Record<string, number>>();
  const myReactByMoment = new Map<string, string[]>();
  const commentsByMoment = new Map<string, { id: string; user_id: string | null; display_name: string; body: string; created_at: string }[]>();

  if (ids.length) {
    const [{ data: reactions }, { data: comments }] = await Promise.all([
      admin.from("canalcup_moment_reactions").select("moment_id, user_id, emoji").in("moment_id", ids),
      admin.from("canalcup_moment_comments").select("id, moment_id, user_id, display_name, body, created_at").in("moment_id", ids).order("created_at", { ascending: true }),
    ]);
    for (const r of reactions ?? []) {
      const counts = reactByMoment.get(r.moment_id) ?? {};
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      reactByMoment.set(r.moment_id, counts);
      if (r.user_id === me.id) {
        const mine = myReactByMoment.get(r.moment_id) ?? [];
        mine.push(r.emoji);
        myReactByMoment.set(r.moment_id, mine);
      }
    }
    for (const c of comments ?? []) {
      const arr = commentsByMoment.get(c.moment_id) ?? [];
      arr.push({ id: c.id, user_id: c.user_id, display_name: c.display_name, body: c.body, created_at: c.created_at });
      commentsByMoment.set(c.moment_id, arr);
    }
  }

  const feed = (moments ?? []).map((m) => ({
    id: m.id,
    author_name: m.author_name,
    title: m.title,
    category: m.category,
    photo_url: m.photo_url,
    media_type: m.media_type ?? "image",
    created_at: m.created_at,
    is_mine: m.user_id === me.id,
    reactions: reactByMoment.get(m.id) ?? {},
    my_reactions: myReactByMoment.get(m.id) ?? [],
    comments: commentsByMoment.get(m.id) ?? [],
  }));

  return NextResponse.json(
    { me: { userId: me.id }, isOrganizer, moments: feed },
    { headers: { "Cache-Control": "no-store" } }
  );
}
