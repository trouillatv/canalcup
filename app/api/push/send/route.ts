import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "contact@canalcup.nc"}`,
    publicKey,
    privateKey
  );
  return true;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();

  if (!profile?.is_active || !["admin", "event_admin", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!configureWebPush()) {
    return NextResponse.json(
      { error: "Configuration push VAPID manquante" },
      { status: 503 }
    );
  }

  const { title, body, url, userIds } = (await request.json()) as {
    title: string;
    body: string;
    url?: string;
    userIds?: string[];
  };

  const admin = createAdminClient();
  let targetAuthIds: string[] | null = null;

  if (userIds?.length) {
    const { data: users } = await admin
      .from("users")
      .select("id, auth_id")
      .in("id", userIds);

    const ids = new Set(userIds);
    for (const user of users ?? []) {
      if (user.auth_id) ids.add(user.auth_id);
    }
    targetAuthIds = Array.from(ids);
  }

  let query = admin.from("push_subscriptions").select("subscription, user_id");
  if (targetAuthIds?.length) {
    query = query.in("user_id", targetAuthIds);
  }

  const { data: rows } = await query;
  if (!rows?.length) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  const payload = JSON.stringify({ title, body, url: url ?? "/" });

  const results = await Promise.allSettled(
    rows.map(({ subscription }) => webpush.sendNotification(subscription, payload))
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  return NextResponse.json({ sent, total: rows.length });
}
