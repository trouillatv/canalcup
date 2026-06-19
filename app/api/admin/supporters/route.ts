// Admin Journée Supporters.
//  GET  : settings + toutes les photos (avec compteur de votes) + total votes.
//  POST : { action: "approve" | "hide" | "open_votes" | "close_votes"
//          | "publish_results" | "unpublish_results", entry_id? }
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import {
  awardToTeam, revokeAward,
  PARTICIPATION_POINTS, PARTICIPATION_LABEL, PODIUM_POINTS, podiumLabel,
} from "@/lib/supporters/service";

type Admin = ReturnType<typeof createAdminClient>;

async function ensureAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "event_admin" || role === "admin" || role === "super_admin";
}

async function postFeed(
  admin: Admin,
  opts: { body: string; type: "photo" | "animation"; contextId: string | null; imageUrl?: string | null }
): Promise<void> {
  await admin
    .from("feed_posts")
    .insert({
      user_id: null,
      display_name: "Journée Supporters",
      type: opts.type,
      context_type: "supporter_photo",
      context_id: opts.contextId,
      body: opts.body,
      image_url: opts.imageUrl ?? null,
      status: "visible",
    })
    .then(() => {}, () => {});
}

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();

  const [{ data: settings }, { data: entries }, { data: teams }, { data: votes }] = await Promise.all([
    admin.from("supporter_settings").select("votes_open, results_published").eq("id", 1).maybeSingle(),
    admin.from("supporter_photo_entries").select("id, team_id, uploaded_by_user_id, title, photo_url, status, podium_rank, participation_awarded, created_at, approved_at").order("created_at", { ascending: false }),
    admin.from("teams").select("id, name"),
    admin.from("supporter_photo_votes").select("entry_id"),
  ]);

  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const voteCount = new Map<string, number>();
  for (const v of votes ?? []) voteCount.set(v.entry_id, (voteCount.get(v.entry_id) ?? 0) + 1);

  const list = (entries ?? []).map((e) => ({
    ...e,
    team_name: teamName.get(e.team_id) ?? "Binôme",
    votes_count: voteCount.get(e.id) ?? 0,
  }));

  return NextResponse.json(
    {
      settings: { votes_open: !!settings?.votes_open, results_published: !!settings?.results_published },
      entries: list,
      totalVotes: (votes ?? []).length,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const action = body?.action as string;
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;

  const getEntry = async () => {
    if (!entryId) return null;
    const { data } = await admin
      .from("supporter_photo_entries")
      .select("id, team_id, title, photo_url, status, participation_awarded")
      .eq("id", entryId)
      .maybeSingle();
    return data;
  };

  switch (action) {
    case "approve": {
      const e = await getEntry();
      if (!e) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
      await admin
        .from("supporter_photo_entries")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("id", e.id);
      // +10 participation (idempotent) — seulement après validation.
      if (!e.participation_awarded) {
        await awardToTeam(admin, {
          teamId: e.team_id, totalPoints: PARTICIPATION_POINTS,
          label: PARTICIPATION_LABEL, sourceId: e.id,
          description: e.title ?? "Photo supporter",
        });
        await admin.from("supporter_photo_entries").update({ participation_awarded: true }).eq("id", e.id);
      }
      await postFeed(admin, {
        body: `📸 Nouvelle photo supporter validée${e.title ? ` : « ${e.title} »` : ""} ! +${PARTICIPATION_POINTS} pts.`,
        type: "photo", contextId: e.id, imageUrl: e.photo_url,
      });
      return NextResponse.json({ ok: true });
    }

    case "hide": {
      const e = await getEntry();
      if (!e) return NextResponse.json({ error: "Photo introuvable." }, { status: 404 });
      await admin.from("supporter_photo_entries").update({ status: "hidden" }).eq("id", e.id);
      // Retire les points liés à cette photo (participation + éventuel podium).
      await revokeAward(admin, { sourceId: e.id, label: PARTICIPATION_LABEL });
      for (const r of [1, 2, 3]) await revokeAward(admin, { sourceId: e.id, label: podiumLabel(r) });
      await admin.from("supporter_photo_entries").update({ participation_awarded: false, podium_rank: null }).eq("id", e.id);
      return NextResponse.json({ ok: true });
    }

    case "open_votes": {
      await admin.from("supporter_settings").update({ votes_open: true, results_published: false, updated_at: new Date().toISOString() }).eq("id", 1);
      await postFeed(admin, { body: "🗳️ Les votes de la Journée Supporters sont OUVERTS ! Vote pour ta photo préférée.", type: "animation", contextId: null });
      return NextResponse.json({ ok: true });
    }

    case "close_votes": {
      await admin.from("supporter_settings").update({ votes_open: false, updated_at: new Date().toISOString() }).eq("id", 1);
      return NextResponse.json({ ok: true });
    }

    case "publish_results": {
      // Classement des photos approuvées par nombre de votes (desc), top 3.
      const [{ data: approved }, { data: votes }] = await Promise.all([
        admin.from("supporter_photo_entries").select("id, team_id, title, photo_url").eq("status", "approved"),
        admin.from("supporter_photo_votes").select("entry_id"),
      ]);
      const count = new Map<string, number>();
      for (const v of votes ?? []) count.set(v.entry_id, (count.get(v.entry_id) ?? 0) + 1);
      const ranked = (approved ?? [])
        .map((e) => ({ ...e, votes: count.get(e.id) ?? 0 }))
        .sort((a, b) => b.votes - a.votes);

      // Réinitialise les rangs + retire d'anciens points podium (recalcul propre).
      for (const e of approved ?? []) {
        for (const r of [1, 2, 3]) await revokeAward(admin, { sourceId: e.id, label: podiumLabel(r) });
      }
      await admin.from("supporter_photo_entries").update({ podium_rank: null }).eq("status", "approved");

      // Top 3 (ignore les ex æquo / 0 vote : on prend l'ordre, jusqu'à 3 avec ≥1 vote).
      const top = ranked.filter((e) => e.votes > 0).slice(0, 3);
      const podium = [];
      for (let i = 0; i < top.length; i++) {
        const rank = i + 1;
        const e = top[i];
        await admin.from("supporter_photo_entries").update({ podium_rank: rank }).eq("id", e.id);
        await awardToTeam(admin, {
          teamId: e.team_id, totalPoints: PODIUM_POINTS[rank],
          label: podiumLabel(rank), sourceId: e.id,
          description: e.title ?? "Photo supporter",
        });
        podium.push({ rank, title: e.title, votes: e.votes });
      }

      await admin.from("supporter_settings").update({ votes_open: false, results_published: true, updated_at: new Date().toISOString() }).eq("id", 1);
      await postFeed(admin, {
        body: `🏆 Podium de la Journée Supporters dévoilé ! ${top.length ? `Bravo aux ${top.length} binômes du podium.` : "Aucun vote enregistré."}`,
        type: "animation", contextId: null,
      });
      return NextResponse.json({ ok: true, podium });
    }

    case "unpublish_results": {
      await admin.from("supporter_settings").update({ results_published: false, updated_at: new Date().toISOString() }).eq("id", 1);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Action invalide." }, { status: 400 });
  }
}
