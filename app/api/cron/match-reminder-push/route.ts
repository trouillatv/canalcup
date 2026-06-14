// Cron toutes les minutes — envoie un rappel push 30 min avant chaque match
// aux utilisateurs abonnés qui n'ont pas encore fait leur prono.
//
// Fenêtre de détection : starts_at dans [NOW()+28min, NOW()+32min] pour
// absorber les décalages entre l'horloge Vercel et l'heure du match.
// Déduplication via match_reminder_log (PK = match_id) : si l'insert réussit
// → première fois, on envoie ; si conflict → déjà envoyé pour ce match, skip.
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
  const lower = new Date(now + 28 * 60_000).toISOString();
  const upper = new Date(now + 32 * 60_000).toISOString();

  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b")
    .eq("status", "upcoming")
    .gte("starts_at", lower)
    .lte("starts_at", upper);

  if (!matches?.length) {
    return NextResponse.json({ ok: true, pushed: 0, skipped: 0 });
  }

  // Toutes les souscriptions push avec l'auth_id associé
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription, endpoint");

  // Correspondance auth.users.id → public.users.id
  const { data: publicUsers } = await supabase
    .from("users")
    .select("id, auth_id");

  const authToPublicId = new Map<string, string>();
  for (const u of publicUsers ?? []) {
    if (u.auth_id) authToPublicId.set(u.auth_id, u.id);
  }

  let pushed = 0;
  let skipped = 0;

  for (const match of matches) {
    // Tentative d'insertion dans le log de déduplication
    const { error: logError, count } = await supabase
      .from("match_reminder_log")
      .insert({ match_id: match.id }, { count: "exact" })
      .select();

    if (logError || count === 0) {
      skipped++;
      continue;
    }

    // Utilisateurs ayant déjà fait leur prono pour ce match
    const { data: existingPreds } = await supabase
      .from("predictions")
      .select("user_id")
      .eq("match_id", match.id);

    const withPred = new Set((existingPreds ?? []).map((p: { user_id: string }) => p.user_id));

    // Ne notifier que les abonnés sans prono
    const subsToNotify = (subs ?? []).filter((sub: { user_id: string }) => {
      const publicId = authToPublicId.get(sub.user_id);
      return publicId && !withPred.has(publicId);
    });

    if (!subsToNotify.length) continue;

    const flagA = match.flag_a ? `${match.flag_a} ` : "";
    const flagB = match.flag_b ? ` ${match.flag_b}` : "";
    const payload = JSON.stringify({
      title: "⏰ Rappel match dans 30 min !",
      body: `${flagA}${match.team_a} – ${match.team_b}${flagB} · Ton prono ?`,
      url: "/matches",
    });

    const results = await Promise.allSettled(
      subsToNotify.map(({ subscription }: { subscription: object }) =>
        webpush.sendNotification(subscription, payload)
      )
    );

    pushed += results.filter((r) => r.status === "fulfilled").length;

    // Nettoyer les souscriptions expirées (410 Gone)
    const expired = results
      .map((r, i) => ({ r, sub: subsToNotify[i] }))
      .filter(({ r }) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.statusCode === 410)
      .map(({ sub }: { sub: { endpoint: string } }) => sub.endpoint);

    if (expired.length) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expired);
    }
  }

  return NextResponse.json({ ok: true, pushed, skipped, matches: matches.length });
}
