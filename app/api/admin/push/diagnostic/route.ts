// Admin — suivi & diagnostic des notifications push.
//  GET  : état VAPID + nb d'abonnés par plateforme.
//  POST : envoi de test (scope "self" = l'admin connecté, ou "all"), renvoie le
//         résultat PAR abonnement (succès / raison d'échec) ; purge optionnelle
//         des abonnements morts (400 clé dépareillée, 403, 404/410 expirés).

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import webpush from "web-push";

function configureWebPush(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(`mailto:${process.env.VAPID_CONTACT_EMAIL ?? "contact@canalcup.nc"}`, pub, priv);
  return true;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return { error: "Unauthorized" as const, status: 401 };
  const { data: profile } = await supabase
    .from("allowlist_users").select("role, is_active").eq("email", user.email).single();
  if (!profile?.is_active || !["admin", "event_admin", "super_admin"].includes(profile.role)) {
    return { error: "Forbidden" as const, status: 403 };
  }
  return { authId: user.id };
}

function platformOf(endpoint: string): "apple" | "fcm" | "firefox" | "autre" {
  if (endpoint.includes("apple.com")) return "apple";
  if (endpoint.includes("fcm.googleapis.com") || endpoint.includes("google")) return "fcm";
  if (endpoint.includes("mozilla")) return "firefox";
  return "autre";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function reasonOf(err: any): { code: number | null; reason: string; dead: boolean } {
  const code = err?.statusCode ?? null;
  const body = String(err?.body ?? "");
  if (code === 400 && /VapidPkHashMismatch/i.test(body))
    return { code, reason: "Clé VAPID dépareillée — re-souscription requise", dead: true };
  if (code === 403) return { code, reason: "VAPID non autorisé (clé/identité serveur)", dead: true };
  if (code === 404 || code === 410) return { code, reason: "Abonnement expiré", dead: true };
  if (code === 413) return { code, reason: "Payload trop gros", dead: false };
  if (code === 429) return { code, reason: "Throttlé par le service push", dead: false };
  return { code, reason: body.slice(0, 120) || "Erreur inconnue", dead: false };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const admin = createAdminClient();
  const { data: subs } = await admin.from("push_subscriptions").select("endpoint, user_id, created_at");
  const counts = { apple: 0, fcm: 0, firefox: 0, autre: 0 };
  for (const s of subs ?? []) counts[platformOf(s.endpoint ?? "")]++;

  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
  return NextResponse.json({
    vapid: {
      configured: !!pub && !!process.env.VAPID_PRIVATE_KEY,
      publicKeyTail: pub ? `…${pub.slice(-10)} (${pub.length})` : null,
      contact: process.env.VAPID_CONTACT_EMAIL ?? "contact@canalcup.nc",
    },
    total: subs?.length ?? 0,
    byPlatform: counts,
    uniqueUsers: new Set((subs ?? []).map((s) => s.user_id)).size,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!configureWebPush()) {
    return NextResponse.json({ error: "VAPID non configuré sur le serveur (clés manquantes)." }, { status: 503 });
  }

  const { scope = "self", prune = false, title, body } = (await request.json().catch(() => ({}))) as {
    scope?: "self" | "all";
    prune?: boolean;
    title?: string;
    body?: string;
  };

  const admin = createAdminClient();
  let query = admin.from("push_subscriptions").select("endpoint, subscription, user_id");
  if (scope === "self") query = query.eq("user_id", auth.authId);
  const { data: rows } = await query;

  if (!rows?.length) {
    return NextResponse.json({ scope, total: 0, sent: 0, results: [], note: scope === "self" ? "Aucun abonnement pour ton compte — active les notifs sur ton appareil d'abord." : "Aucun abonnement." });
  }

  const payload = JSON.stringify({
    title: title || "🔔 Test Canal Cup",
    body: body || "Test des notifications push — tu reçois bien ceci ?",
    url: "/",
  });

  const results = await Promise.allSettled(
    rows.map((r) => webpush.sendNotification(r.subscription as webpush.PushSubscription, payload))
  );

  const detailed = results.map((r, i) => {
    const sub = rows[i];
    const platform = platformOf(sub.endpoint ?? "");
    if (r.status === "fulfilled") {
      return { endpoint: `…${(sub.endpoint ?? "").slice(-18)}`, platform, ok: true, code: r.value.statusCode, reason: "OK" };
    }
    const { code, reason, dead } = reasonOf((r as PromiseRejectedResult).reason);
    return { endpoint: `…${(sub.endpoint ?? "").slice(-18)}`, platform, ok: false, code, reason, dead };
  });

  const sent = detailed.filter((d) => d.ok).length;

  // Purge des abonnements morts si demandé.
  let pruned = 0;
  if (prune) {
    const toDelete = results
      .map((r, i) => ({ r, ep: rows[i]?.endpoint }))
      .filter(({ r }) => r.status === "rejected" && reasonOf((r as PromiseRejectedResult).reason).dead)
      .map(({ ep }) => ep)
      .filter(Boolean) as string[];
    if (toDelete.length) {
      await admin.from("push_subscriptions").delete().in("endpoint", toDelete);
      pruned = toDelete.length;
    }
  }

  return NextResponse.json({ scope, total: rows.length, sent, pruned, results: detailed });
}
