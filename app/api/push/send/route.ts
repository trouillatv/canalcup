import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .single();

  if (profile?.role !== "admin") {
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

  let query = supabase.from("push_subscriptions").select("subscription");
  if (userIds?.length) {
    query = query.in("user_id", userIds);
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
