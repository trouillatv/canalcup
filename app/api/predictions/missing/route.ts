import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ matches: [] });

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .single();
  if (!profile) return NextResponse.json({ matches: [] });

  const now = new Date().toISOString();

  // Upcoming matches not yet started
  const { data: upcoming } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, starts_at, channel")
    .eq("status", "upcoming")
    .gt("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(10);

  if (!upcoming?.length) return NextResponse.json({ matches: [] });

  const matchIds = upcoming.map((m) => m.id);

  const { data: predictions } = await supabase
    .from("predictions")
    .select("match_id")
    .eq("user_id", profile.id)
    .in("match_id", matchIds);

  const predictedIds = new Set((predictions ?? []).map((p) => p.match_id));
  const missing = upcoming.filter((m) => !predictedIds.has(m.id));

  return NextResponse.json({ matches: missing });
}
