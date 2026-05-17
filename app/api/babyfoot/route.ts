import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 30;

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("babyfoot_matches")
    .select("*, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)")
    .order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
