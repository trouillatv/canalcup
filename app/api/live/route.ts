import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";

async function ensureGeneralChannel() {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("vestiaire_channels")
    .select("id")
    .eq("type", "general")
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await admin
    .from("vestiaire_channels")
    .insert({
      type: "general",
      title: "Canal general",
      description: "Toute la Canal Cup, chambrage compris.",
      is_private: false,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

function feedKind(type: string) {
  if (type === "robert") return "robert";
  if (type === "match") return "match";
  if (["animation", "quiz", "babyfoot", "photo"].includes(type)) return "animation";
  return "system";
}

export async function GET() {
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const admin = createAdminClient();
  const [feedRes, messageRes] = await Promise.all([
    admin
      .from("feed_posts")
      .select("*")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("vestiaire_messages")
      .select("*, channel:vestiaire_channels(title, type, is_private, team_id)")
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  if (feedRes.error) return NextResponse.json({ error: feedRes.error.message }, { status: 500 });
  if (messageRes.error) return NextResponse.json({ error: messageRes.error.message }, { status: 500 });

  const visibleMessages = (messageRes.data ?? []).filter((message: any) => {
    const channel = message.channel;
    return !channel?.is_private || channel.team_id === me.teamId;
  });

  const messageIds = visibleMessages.map((message: any) => message.id);
  const { data: reactions } = messageIds.length
    ? await admin
        .from("vestiaire_message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds)
    : { data: [] };

  const reactionsByMessage = new Map<string, Record<string, number>>();
  const mineByMessage = new Map<string, string[]>();
  for (const reaction of reactions ?? []) {
    const counts = reactionsByMessage.get(reaction.message_id) ?? {};
    counts[reaction.emoji] = (counts[reaction.emoji] ?? 0) + 1;
    reactionsByMessage.set(reaction.message_id, counts);
    if (reaction.user_id === me.userId) {
      mineByMessage.set(reaction.message_id, [...(mineByMessage.get(reaction.message_id) ?? []), reaction.emoji]);
    }
  }

  const feedItems = (feedRes.data ?? []).map((post: any) => ({
    id: post.id,
    source: "feed",
    kind: feedKind(post.type),
    title: post.type === "robert" ? "Robert" : "Canal Cup",
    author: post.display_name ?? post.email ?? "Canal Cup",
    body: post.body,
    created_at: post.created_at,
    type: post.type,
  }));

  const messageItems = visibleMessages.map((message: any) => {
    const counts = reactionsByMessage.get(message.id) ?? {};
    return {
      id: message.id,
      source: "vestiaire",
      kind: "colleague",
      title: message.channel?.title ?? "Vestiaire",
      author: message.display_name ?? message.email ?? "Supporter",
      body: message.body,
      created_at: message.created_at,
      reactions: counts,
      mine_reactions: mineByMessage.get(message.id) ?? [],
      reaction_count: Object.values(counts).reduce((sum: number, n: any) => sum + Number(n ?? 0), 0),
    };
  });

  const items = [...feedItems, ...messageItems]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 120);

  return NextResponse.json(items, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (text.length < 3) return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Message trop long (1000 max)" }, { status: 400 });

  const channelId = await ensureGeneralChannel();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vestiaire_messages")
    .insert({
      channel_id: channelId,
      user_id: me.userId,
      email: me.email,
      display_name: me.displayName,
      body: text,
      status: "visible",
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
