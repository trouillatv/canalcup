// GET /api/supporters — état du concours + galerie + ma photo + mon vote.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PODIUM_POINTS } from "@/lib/supporters/service";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, team_id, display_name, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const [{ data: settings }, { data: entries }, { data: teams }, { data: myVote }] =
    await Promise.all([
      admin.from("supporter_settings").select("votes_open, results_published").eq("id", 1).maybeSingle(),
      admin.from("supporter_photo_entries").select("id, team_id, uploaded_by_user_id, title, photo_url, status, podium_rank, created_at"),
      admin.from("teams").select("id, name"),
      admin.from("supporter_photo_votes").select("entry_id").eq("voter_user_id", me.id).maybeSingle(),
    ]);

  const resultsPublished = !!settings?.results_published;
  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  // Comptage des votes par entry (révélé seulement après publication).
  const voteCount = new Map<string, number>();
  if (resultsPublished) {
    const { data: allVotes } = await admin.from("supporter_photo_votes").select("entry_id");
    for (const v of allVotes ?? []) voteCount.set(v.entry_id, (voteCount.get(v.entry_id) ?? 0) + 1);
  }

  const approved = (entries ?? []).filter((e) => e.status === "approved");
  const gallery = approved.map((e) => ({
    id: e.id,
    team_id: e.team_id,
    team_name: teamName.get(e.team_id) ?? "Binôme",
    title: e.title,
    photo_url: e.photo_url,
    is_mine: e.team_id === me.team_id,
    votes_count: resultsPublished ? voteCount.get(e.id) ?? 0 : null,
  }));

  // Ma photo (tous statuts confondus pour mon binôme).
  const mine = me.team_id ? (entries ?? []).find((e) => e.team_id === me.team_id) ?? null : null;
  const myEntry = mine
    ? { id: mine.id, title: mine.title, photo_url: mine.photo_url, status: mine.status }
    : null;

  // Podium (après publication).
  let results = null;
  if (resultsPublished) {
    results = approved
      .filter((e) => e.podium_rank)
      .sort((a, b) => (a.podium_rank ?? 9) - (b.podium_rank ?? 9))
      .map((e) => ({
        rank: e.podium_rank as number,
        team_name: teamName.get(e.team_id) ?? "Binôme",
        title: e.title,
        photo_url: e.photo_url,
        votes_count: voteCount.get(e.id) ?? 0,
        points: PODIUM_POINTS[e.podium_rank as number] ?? 0,
      }));
  }

  const totalVotes = resultsPublished
    ? [...voteCount.values()].reduce((a, b) => a + b, 0)
    : null;

  return NextResponse.json(
    {
      settings: { votes_open: !!settings?.votes_open, results_published: resultsPublished },
      me: { userId: me.id, teamId: me.team_id, teamName: me.team_id ? teamName.get(me.team_id) ?? null : null },
      myEntry,
      myVote: myVote ? { entry_id: myVote.entry_id } : null,
      gallery,
      results,
      totalVotes,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
