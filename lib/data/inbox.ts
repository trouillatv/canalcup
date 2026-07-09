// Producteurs de courriers inbox_events (contexte cron / serveur, client
// service_role). Les consommateurs sont /api/inbox{,/unread,/read}.
//
// Idempotence : à la charge de l'appelant. Le cron matinale est déjà
// idempotent (early-return si la matinale du jour existe) ; pour les crons
// sans garde, utiliser wasBroadcastToday() avant de broadcaster.

import { createAdminClient } from "@/lib/supabase/admin";

type InboxType = "mention" | "vote_received" | "badge" | "matinale" | "roast" | "babyfoot";

// Crée UN courrier pour un utilisateur précis (public users.id). Renvoie true si
// le courrier a été inséré. Utilisé pour les notifications ciblées (ex. baby-foot :
// « Julien a modifié les créneaux du binôme »).
export async function createInboxEvent(evt: {
  userId: string;
  teamId?: string | null;
  type: InboxType;
  title: string;
  message: string;
}): Promise<boolean> {
  const admin = createAdminClient();
  const { error } = await admin.from("inbox_events").insert({
    user_id: evt.userId,
    team_id: evt.teamId ?? null,
    type: evt.type,
    title: evt.title,
    message: evt.message,
  });
  return !error;
}

// Crée 1 courrier pour chaque utilisateur réel (auth_id non nul).
// Renvoie le nombre de courriers créés (0 si échec / aucun utilisateur).
export async function broadcastInboxEvent(evt: {
  type: InboxType;
  title: string;
  message: string;
}): Promise<number> {
  const admin = createAdminClient();
  const { data: users } = await admin
    .from("users")
    .select("id, team_id")
    .not("auth_id", "is", null);
  if (!users?.length) return 0;

  const rows = users.map((u) => ({
    user_id: u.id,
    team_id: u.team_id ?? null,
    type: evt.type,
    title: evt.title,
    message: evt.message,
  }));
  const { error } = await admin.from("inbox_events").insert(rows);
  return error ? 0 : rows.length;
}

// Garde anti-doublon : un courrier de ce type a-t-il déjà été créé aujourd'hui ?
// À appeler avant broadcastInboxEvent dans les crons sans idempotence propre.
export async function wasBroadcastToday(type: InboxType): Promise<boolean> {
  const admin = createAdminClient();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { count } = await admin
    .from("inbox_events")
    .select("id", { count: "exact", head: true })
    .eq("type", type)
    .gte("created_at", start.toISOString());
  return (count ?? 0) > 0;
}

// Note : type 'vote_received' supporté mais sans producteur — il n'existe
// aucun chemin de création de vote (UI votes non retenue). Brancher ici dès
// qu'une insertion dans `votes` existera (notifier le user voté).
