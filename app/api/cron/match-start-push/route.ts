// Cron toutes les minutes — envoie un push à tous les abonnés quand un match
// vient de commencer. Déduplication via match_push_log (primary key match_id) :
// si l'insert réussit → première fois, on envoie ; si conflict → déjà fait, skip.
//
// Fenêtre de détection : starts_at dans [NOW()-90s, NOW()+90s] pour absorber
// les décalages entre l'horloge Vercel et l'heure officielle du match.
// Le dedup garantit qu'on n'envoie qu'une seule fois même si le cron feu twice.
//
// Auth : Bearer CRON_SECRET (auto-injecté par Vercel).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

export const dynamic = "force-dynamic";

function configureWebPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_CONTACT_EMAIL ?? "contact@canalcup.nc"}`,
    pub,
    priv
  );
  return true;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (
    process.env.NODE_ENV === "production" &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!configureWebPush()) {
    return NextResponse.json({ error: "VAPID not configured" }, { status: 503 });
  }

  const supabase = createAdminClient();
  const now = Date.now();
  const lower = new Date(now - 90_000).toISOString();
  const upper = new Date(now + 90_000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b")
    .neq("status", "finished")
    .gte("starts_at", lower)
    .lte("starts_at", upper);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, pushed: 0, skipped: 0 });
  }

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("subscription");

  let pushed = 0;
  let skipped = 0;

  for (const match of matches) {
    // Tentative d'insertion dans le log — échoue silencieusement si déjà envoyé
    const { error: logError, count } = await supabase
      .from("match_push_log")
      .insert({ match_id: match.id }, { count: "exact" })
      .select();

    if (logError || count === 0) {
      skipped++;
      continue;
    }

    if (!subs?.length) continue;

    const payload = JSON.stringify({
      title: "⚽ Match en cours !",
      body: `${match.team_a} – ${match.team_b} vient de commencer`,
      url: "/matches",
    });

    const results = await Promise.allSettled(
      subs.map(({ subscription }) =>
        webpush.sendNotification(subscription, payload)
      )
    );

    const sentCount = results.filter((r) => r.status === "fulfilled").length;
    pushed += sentCount;

    // Nettoyer les souscriptions expirées (410 Gone)
    const expired = results
      .map((r, i) => ({ r, sub: subs[i] }))
      .filter(({ r }) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.statusCode === 410)
      .map(({ sub }) => (sub.subscription as { endpoint: string }).endpoint);

    if (expired.length) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expired);
    }
  }

  return NextResponse.json({ ok: true, pushed, skipped, matches: matches.length });
}
