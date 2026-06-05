import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";

async function canAccessChannel(channelId: string, teamId: string | null) {
  const admin = createAdminClient();
  const { data: channel } = await admin
    .from("vestiaire_channels")
    .select("id, is_private, team_id, is_active")
    .eq("id", channelId)
    .maybeSingle();

  if (!channel?.is_active) return false;
  return !channel.is_private || channel.team_id === teamId;
}

export async function GET(req: Request) {
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const channelId = new URL(req.url).searchParams.get("channel_id");
  if (!channelId) return NextResponse.json({ error: "Salon requis" }, { status: 400 });
  if (!(await canAccessChannel(channelId, me.teamId))) {
    return NextResponse.json({ error: "Salon inaccessible" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("vestiaire_messages")
    .select("*")
    .eq("channel_id", channelId)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const channelId = typeof body.channel_id === "string" ? body.channel_id : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";

  if (!channelId) return NextResponse.json({ error: "Salon requis" }, { status: 400 });
  if (!(await canAccessChannel(channelId, me.teamId))) {
    return NextResponse.json({ error: "Salon inaccessible" }, { status: 403 });
  }
  if (text.length < 3) return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "Message trop long (1000 max)" }, { status: 400 });

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
