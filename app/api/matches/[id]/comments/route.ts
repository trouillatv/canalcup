import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentSocialUser } from "@/lib/social/profile";
import { sendPushToAll } from "@/lib/push";

type MatchCommentRow = {
  id: string;
  match_id: string;
  user_id: string | null;
  email: string | null;
  display_name: string | null;
  body: string;
  status: string;
  created_at: string;
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
  const { id } = await params;
  const me = await getCurrentSocialUser();
  if (!me?.userId) return NextResponse.json({ error: "Non authentifie" }, { status: 401 });

  if (!(await matchExists(id))) {
    return NextResponse.json({ error: "Match introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const text = typeof body.body === "string" ? body.body.trim() : "";

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
      status: "visible",
    })
    .select("id, match_id, user_id, email, display_name, body, status, created_at")
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

  // Notifier les autres abonnés push (best-effort — ne bloque jamais la réponse)
  try {
    const { data: m } = await admin
      .from("matches")
      .select("team_a, team_b")
      .eq("id", id)
      .maybeSingle();
    const who = me.displayName?.trim() || "Quelqu'un";
    const snippet = text.length > 80 ? `${text.slice(0, 77)}…` : text;
    await sendPushToAll(
      {
        title: "💬 Nouveau commentaire",
        body: m ? `${who} sur ${m.team_a} – ${m.team_b} : ${snippet}` : `${who} : ${snippet}`,
        url: `/matches/${id}?tab=chat`,
      },
      { excludeAuthIds: [me.authId] }
    );
  } catch {
    /* push best-effort */
  }

  return NextResponse.json(data, { status: 201 });
}
