import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("allowlist_users").select("role").eq("email", user.email!).single();
  if (profile?.role !== "admin" && profile?.role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const [{ data: allUsers }, { data: subs }] = await Promise.all([
    admin.from("users").select("id, display_name, name"),
    admin.from("push_subscriptions").select("user_id, endpoint"),
  ]);

  const subscribedIds = new Set((subs ?? []).map((s: { user_id: string }) => s.user_id));
  const subsByUserId = (subs ?? []).reduce((acc: Record<string, string>, s: { user_id: string; endpoint: string }) => {
    acc[s.user_id] = s.endpoint;
    return acc;
  }, {});

  const subscribers = (allUsers ?? [])
    .filter((u: { id: string }) => subscribedIds.has(u.id))
    .map((u: { id: string; display_name: string; name: string }) => ({
      user_id: u.id,
      display_name: u.display_name ?? u.name ?? "—",
      endpoint: subsByUserId[u.id],
    }));

  const nonSubscribers = (allUsers ?? [])
    .filter((u: { id: string }) => !subscribedIds.has(u.id))
    .map((u: { id: string; display_name: string; name: string }) => ({
      id: u.id,
      display_name: u.display_name ?? u.name ?? "—",
    }));

  return NextResponse.json({
    subscribed: subscribers.length,
    total: (allUsers ?? []).length,
    subscribers,
    nonSubscribers,
  });
}
