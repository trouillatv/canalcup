import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";

async function ensureDefaultChannels() {
  const admin = createAdminClient();
  const defaults = [
    {
      type: "general",
      title: "Canal general",
      description: "Toute la Canal Cup, chambrage compris.",
    },
    {
      type: "animation",
      title: "Animations",
      description: "Quiz, defis, photos supporters et protestations sportives.",
    },
  ];

  for (const channel of defaults) {
    const { data: existing } = await admin
      .from("vestiaire_channels")
      .select("id")
      .eq("type", channel.type)
      .maybeSingle();
    if (!existing) {
      await admin.from("vestiaire_channels").insert({
        ...channel,
        is_private: false,
        is_active: true,
      });
    }
  }
}

export async function GET() {
  const me = await getCurrentSocialUser();
  if (!me) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  await ensureDefaultChannels();
  const admin = createAdminClient();

  if (me.teamId) {
    const { data: team } = await admin.from("teams").select("id, name").eq("id", me.teamId).maybeSingle();
    if (team) {
      const { data: existingTeamChannel } = await admin
        .from("vestiaire_channels")
        .select("id")
        .eq("type", "team")
        .eq("team_id", team.id)
        .maybeSingle();

      if (!existingTeamChannel) {
        await admin.from("vestiaire_channels").insert({
          type: "team",
          title: team.name,
          description: "Salon prive de ton equipe.",
          team_id: team.id,
          is_private: true,
          is_active: true,
        });
      }
    }
  }

  const { data, error } = await admin
    .from("vestiaire_channels")
    .select("*")
    .eq("is_active", true)
    .order("is_private", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const channels = (data ?? []).filter((channel) => !channel.is_private || channel.team_id === me.teamId);
  return NextResponse.json(channels, { headers: { "Cache-Control": "no-store" } });
}
