import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser, isSocialAdmin } from "@/lib/social/profile";
import type { FeedPostType } from "@/lib/supabase/types";
import { competitionLock } from "@/lib/event/status";

const FEED_TYPES: FeedPostType[] = [
  "ambiance",
  "photo",
  "chambrage",
  "match",
  "babyfoot",
  "quiz",
  "animation",
  "robert",
];

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feed_posts")
    .select("*")
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(80);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const requestedType = typeof body.type === "string" ? body.type : "ambiance";
  const type = FEED_TYPES.includes(requestedType as FeedPostType)
    ? (requestedType as FeedPostType)
    : "ambiance";

  if (text.length < 3) return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  if (text.length > 1200) return NextResponse.json({ error: "Message trop long (1200 max)" }, { status: 400 });
  if (type === "robert" && !isSocialAdmin(me)) {
    return NextResponse.json({ error: "Le Goat est reserve aux admins" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feed_posts")
    .insert({
      user_id: me.userId,
      email: me.email,
      display_name: me.displayName,
      type,
      context_type: typeof body.context_type === "string" ? body.context_type.slice(0, 50) : null,
      context_id: typeof body.context_id === "string" ? body.context_id : null,
      body: text,
      image_url: typeof body.image_url === "string" ? body.image_url.slice(0, 500) : null,
      status: "visible",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
