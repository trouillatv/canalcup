import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";
import { sendPushToUser } from "@/lib/push";
import { competitionLock } from "@/lib/event/status";

// Organisateurs notifiés de CHAQUE commentaire (monitoring du live).
const ORGANIZER_EMAILS = ["vincent.trouillat@canal-plus.com", "trouillatv@gmail.com"];

type MatchCommentRow = {
  id: string;
  match_id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  body: string;
  status: string;
  created_at: string;
  parent_comment_id: string | null;
};

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /match_comments|match_comment_reads/i.test(error.message ?? "");
}

async function getVisibleComments(matchId: string) {
  const admin = createAdminClient();
  return await admin
    .from("match_comments")
    .select("id, match_id, user_id, email, display_name, body, status, created_at")
    .eq("match_id", matchId)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .limit(300);
}

async function matchExists(matchId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("matches").select("id").eq("id", matchId).maybeSingle();
  return !!data;
}

function countUnread(messages: MatchCommentRow[], userId: string, lastReadAt: string | null): number {
  const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : 0;
  return messages.filter((message) => {
    if (message.user_id === userId) return false;
    return new Date(message.created_at).getTime() > lastReadTime;
  }).length;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getCurrentSocialUser();
  if (!me?.userId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  if (!(await matchExists(id))) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: comments, error } = await getVisibleComments(id);
  if (isMissingTableError(error)) {
    return NextResponse.json(
      { messages: [], total: 0, unread: 0, setupRequired: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: readCursor } = await admin
    .from("match_comment_reads")
    .select("last_read_at")
    .eq("match_id", id)
    .eq("user_id", me.userId)
    .maybeSingle();

  const messages = (comments ?? []) as MatchCommentRow[];
  const unread = countUnread(messages, me.userId, readCursor?.last_read_at ?? null);
  const url = new URL(req.url);
  const summaryOnly = url.searchParams.get("summary") === "1";
  const markRead = url.searchParams.get("mark_read") === "1";

  if (markRead) {
    await admin
      .from("match_comment_reads")
      .upsert(
        { match_id: id, user_id: me.userId, last_read_at: new Date().toISOString() },
        { onConflict: "match_id,user_id" }
      );
  }

  if (summaryOnly) {
    return NextResponse.json(
      { total: messages.length, unread },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    { messages, total: messages.length, unread },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const { id } = await params;
  const me = await getCurrentSocialUser();
  if (!me?.userId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  if (!(await matchExists(id))) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const parentId = typeof body.parent_comment_id === "string" ? body.parent_comment_id : null;

  if (text.length < 2) return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  if (text.length > 500) return NextResponse.json({ error: "Message trop long (500 max)" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("match_comments")
    .insert({
      match_id: id,
      user_id: me.userId,
      email: me.email,
      display_name: me.displayName,
      body: text,
      parent_comment_id: parentId,
      status: "visible",
    })
    .select("id, match_id, user_id, email, display_name, body, status, created_at, parent_comment_id")
    .single();

  if (isMissingTableError(error)) {
    return NextResponse.json(
      { error: "La table des commentaires de match n'est pas encore creee." },
      { status: 503 }
    );
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin
    .from("match_comment_reads")
    .upsert(
      { match_id: id, user_id: me.userId, last_read_at: new Date().toISOString() },
      { onConflict: "match_id,user_id" }
    );

  // Push CIBLÉ (best-effort, ne bloque jamais) — JAMAIS un broadcast à tous :
  //   1) réponse → uniquement l'auteur du commentaire d'origine.
  //   2) tout commentaire sur un match LIVE → les organisateurs (monitoring).
  try {
    const { data: m } = await admin
      .from("matches")
      .select("team_a, team_b, status")
      .eq("id", id)
      .maybeSingle();
    const who = me.displayName?.trim() || "Quelqu'un";
    const snippet = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    const url = `/matches/${id}?tab=chat`;
    const matchLabel = m ? `${m.team_a} – ${m.team_b}` : "le match";
    const pushed = new Set<string>([me.authId]); // jamais se notifier soi-même

    // 1) Réponse → l'auteur du commentaire parent.
    if (parentId) {
      const { data: parent } = await admin
        .from("match_comments").select("user_id").eq("id", parentId).maybeSingle();
      if (parent?.user_id && parent.user_id !== me.userId) {
        const { data: pu } = await admin.from("users").select("auth_id").eq("id", parent.user_id).maybeSingle();
        if (pu?.auth_id && !pushed.has(pu.auth_id)) {
          await sendPushToUser(pu.auth_id, { title: "💬 On a répondu à ton commentaire", body: `${who} : ${snippet}`, url });
          pushed.add(pu.auth_id);
        }
      }
    }

    // 2) Monitoring organisateurs — seulement sur un match en cours.
    if (m?.status === "live" || m?.status === "halftime") {
      const { data: orgs } = await admin.from("users").select("auth_id, email").in("email", ORGANIZER_EMAILS);
      for (const o of (orgs ?? []) as { auth_id: string | null; email: string | null }[]) {
        if (!o.auth_id || pushed.has(o.auth_id)) continue;
        await sendPushToUser(o.auth_id, { title: "💬 Commentaire live", body: `${who} sur ${matchLabel} : ${snippet}`, url });
        pushed.add(o.auth_id);
      }
    }
  } catch {
    /* push best-effort */
  }

  return NextResponse.json(data, { status: 201 });
}
