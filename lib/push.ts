// Helper d'envoi de notifications Web Push.
// push_subscriptions.user_id = auth.users.id (l'auth_id), pas le public users.id.

import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

export function configureWebPush(): boolean {
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

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

type SubRow = { user_id: string; subscription: webpush.PushSubscription; endpoint: string };

// Envoie une notif à UN utilisateur (toutes ses souscriptions). `authId` =
// auth.users.id (= push_subscriptions.user_id). Nettoie les souscriptions
// expirées (410). No-op si VAPID non configuré ou aucun abonnement.
export async function sendPushToUser(
  authId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  if (!authId || !configureWebPush()) return { sent: 0, failed: 0 };

  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription, endpoint")
    .eq("user_id", authId);
  if (!subs?.length) return { sent: 0, failed: 0 };

  const json = JSON.stringify(payload);
  const results = await Promise.allSettled(
    (subs as SubRow[]).map((s) => webpush.sendNotification(s.subscription, json))
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;

  const expired = results
    .map((r, i) => ({ r, sub: (subs as SubRow[])[i] }))
    .filter(
      ({ r }) =>
        r.status === "rejected" &&
        (r as PromiseRejectedResult).reason?.statusCode === 410
    )
    .map(({ sub }) => sub.endpoint);
  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return { sent, failed: results.length - sent };
}

// Envoie une notif à tous les abonnés push, en excluant éventuellement
// certains auth_id (ex. l'auteur d'un commentaire). Nettoie au passage les
// souscriptions expirées (410 Gone). No-op si VAPID non configuré.
export async function sendPushToAll(
  payload: PushPayload,
  opts: { excludeAuthIds?: string[] } = {}
): Promise<{ sent: number; failed: number }> {
  if (!configureWebPush()) return { sent: 0, failed: 0 };

  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("user_id, subscription, endpoint");
  if (!subs?.length) return { sent: 0, failed: 0 };

  const exclude = new Set(opts.excludeAuthIds ?? []);
  const targets = (subs as SubRow[]).filter((s) => !exclude.has(s.user_id));
  if (!targets.length) return { sent: 0, failed: 0 };

  const json = JSON.stringify(payload);
  const results = await Promise.allSettled(
    targets.map((s) => webpush.sendNotification(s.subscription, json))
  );
  const sent = results.filter((r) => r.status === "fulfilled").length;

  const expired = results
    .map((r, i) => ({ r, sub: targets[i] }))
    .filter(
      ({ r }) =>
        r.status === "rejected" &&
        (r as PromiseRejectedResult).reason?.statusCode === 410
    )
    .map(({ sub }) => sub.endpoint);

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return { sent, failed: results.length - sent };
}
