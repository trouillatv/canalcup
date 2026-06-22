// GET /api/tv/moments — données TV salon du Mur « Moments CanalCup » (public,
// sans auth, via service). Photos visibles + réactions + derniers commentaires.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();
  const { data: moments } = await admin
    .from("canalcup_moments")
    .select("id, author_name, title, category, photo_url, media_type, created_at")
    .eq("status", "visible")
    .order("created_at", { ascending: false });

  const ids = (moments ?? []).map((m) => m.id);
  const reactByMoment = new Map<string, Record<string, number>>();
  const commentsByMoment = new Map<string, { display_name: string; body: string }[]>();
  if (ids.length) {
    const [{ data: reactions }, { data: comments }] = await Promise.all([
      admin.from("canalcup_moment_reactions").select("moment_id, emoji").in("moment_id", ids),
      admin.from("canalcup_moment_comments").select("moment_id, display_name, body, created_at").in("moment_id", ids).order("created_at", { ascending: false }),
    ]);
    for (const r of reactions ?? []) {
      const c = reactByMoment.get(r.moment_id) ?? {};
      c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      reactByMoment.set(r.moment_id, c);
    }
    for (const c of comments ?? []) {
      const arr = commentsByMoment.get(c.moment_id) ?? [];
      if (arr.length < 4) arr.push({ display_name: c.display_name, body: c.body });
      commentsByMoment.set(c.moment_id, arr);
    }
  }

  const photos = (moments ?? []).map((m) => ({
    id: m.id,
    author_name: m.author_name,
    title: m.title,
    category: m.category,
    photo_url: m.photo_url,
    media_type: m.media_type ?? "image",
    created_at: m.created_at,
    reactions: reactByMoment.get(m.id) ?? {},
    comments: commentsByMoment.get(m.id) ?? [],
  }));

  return NextResponse.json({ photos }, { headers: { "Cache-Control": "no-store" } });
}
