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

  // Le mur TV se nourrit AUSSI des photos du concours Supporters (catégorie
  // « supporters »). Lecture seule, le concours reste séparé.
  const { data: entries } = await admin
    .from("supporter_photo_entries")
    .select("id, team_id, title, photo_url, media_type, created_at")
    .eq("status", "approved");
  const eids = (entries ?? []).map((e) => e.id);
  const supReact = new Map<string, Record<string, number>>();
  const supComments = new Map<string, { display_name: string; body: string }[]>();
  let teamName = new Map<string, string>();
  if (eids.length) {
    const [{ data: rs }, { data: cs }, { data: teams }] = await Promise.all([
      admin.from("supporter_photo_reactions").select("entry_id, emoji").in("entry_id", eids),
      admin.from("supporter_photo_comments").select("entry_id, display_name, body, created_at").in("entry_id", eids).order("created_at", { ascending: false }),
      admin.from("teams").select("id, name"),
    ]);
    for (const r of rs ?? []) { const m = supReact.get(r.entry_id) ?? {}; m[r.emoji] = (m[r.emoji] ?? 0) + 1; supReact.set(r.entry_id, m); }
    for (const c of cs ?? []) { const a = supComments.get(c.entry_id) ?? []; if (a.length < 4) a.push({ display_name: c.display_name, body: c.body }); supComments.set(c.entry_id, a); }
    teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  }
  const supPhotos = (entries ?? []).map((e) => ({
    id: `sup:${e.id}`,
    author_name: teamName.get(e.team_id) ?? "Binôme",
    title: e.title,
    category: "supporters",
    photo_url: e.photo_url,
    media_type: e.media_type ?? "image",
    created_at: e.created_at,
    reactions: supReact.get(e.id) ?? {},
    comments: supComments.get(e.id) ?? [],
  }));

  const all = [...photos, ...supPhotos].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({ photos: all }, { headers: { "Cache-Control": "no-store" } });
}
