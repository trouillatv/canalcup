// GET /api/supporters — état du concours + galerie + ma photo + mon vote.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { PODIUM_POINTS } from "@/lib/supporters/service";
import { isSupportersOrganizer, VOTES_CLOSE_AT, votesClosed } from "@/lib/supporters/access";

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

  const role = await getCurrentUserRole();
  const isOrganizer = isSupportersOrganizer(role, user.email);

  const [{ data: settings }, { data: entries }, { data: teams }, { data: myVote }] =
    await Promise.all([
      admin.from("supporter_settings").select("votes_open, results_published").eq("id", 1).maybeSingle(),
      admin.from("supporter_photo_entries").select("id, team_id, uploaded_by_user_id, title, photo_url, status, podium_rank, created_at"),
      admin.from("teams").select("id, name"),
      admin.from("supporter_photo_votes").select("entry_id").eq("voter_user_id", me.id).maybeSingle(),
    ]);

  const resultsPublished = !!settings?.results_published;
  const closed = votesClosed();
  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));

  // Comptage des votes par entry. Révélé après publication OU aux organisateurs
  // (Marie/Vincent voient les votes au fil de l'eau).
  const revealVotes = resultsPublished || isOrganizer;
  const voteCount = new Map<string, number>();
  if (revealVotes) {
    const { data: allVotes } = await admin.from("supporter_photo_votes").select("entry_id");
    for (const v of allVotes ?? []) voteCount.set(v.entry_id, (voteCount.get(v.entry_id) ?? 0) + 1);
  }

  const approved = (entries ?? []).filter((e) => e.status === "approved");

  // Commentaires groupés par photo (chambrage).
  const commentsByEntry = new Map<string, { id: string; user_id: string | null; display_name: string; body: string; created_at: string }[]>();
  if (approved.length) {
    const { data: comments } = await admin
      .from("supporter_photo_comments")
      .select("id, entry_id, user_id, display_name, body, created_at")
      .in("entry_id", approved.map((e) => e.id))
      .order("created_at", { ascending: true });
    for (const c of comments ?? []) {
      const arr = commentsByEntry.get(c.entry_id) ?? [];
      arr.push({ id: c.id, user_id: c.user_id, display_name: c.display_name, body: c.body, created_at: c.created_at });
      commentsByEntry.set(c.entry_id, arr);
    }
  }

  const gallery = approved.map((e) => ({
    id: e.id,
    team_id: e.team_id,
    team_name: teamName.get(e.team_id) ?? "Binôme",
    title: e.title,
    photo_url: e.photo_url,
    is_mine: e.team_id === me.team_id,
    votes_count: revealVotes ? voteCount.get(e.id) ?? 0 : null,
    comments: commentsByEntry.get(e.id) ?? [],
  }));

  // Onglet organisateur « N'ont pas voté » : joueurs inscrits + leur binôme +
  // statut de vote. Réservé à Marie & Vincent.
  let participants: { name: string; teamName: string | null; voted: boolean }[] | null = null;
  if (isOrganizer) {
    const [{ data: allUsers }, { data: allVotes }] = await Promise.all([
      admin.from("users").select("id, display_name, name, team_id").eq("profile_completed", true),
      admin.from("supporter_photo_votes").select("voter_user_id"),
    ]);
    const voters = new Set((allVotes ?? []).map((v) => v.voter_user_id));
    participants = (allUsers ?? [])
      .map((u) => ({
        name: u.display_name || u.name || "Joueur",
        teamName: u.team_id ? teamName.get(u.team_id) ?? null : null,
        voted: voters.has(u.id),
      }))
      .sort((a, b) => Number(a.voted) - Number(b.voted) || a.name.localeCompare(b.name));
  }

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

  const totalVotes = revealVotes
    ? [...voteCount.values()].reduce((a, b) => a + b, 0)
    : null;

  // Vote effectivement possible : flag admin ouvert ET avant clôture.
  const votesEffectivelyOpen = !!settings?.votes_open && !resultsPublished && !closed;

  return NextResponse.json(
    {
      settings: {
        votes_open: votesEffectivelyOpen,
        results_published: resultsPublished,
        votes_closed: closed,
        close_at: VOTES_CLOSE_AT,
      },
      me: { userId: me.id, teamId: me.team_id, teamName: me.team_id ? teamName.get(me.team_id) ?? null : null },
      isOrganizer,
      myEntry,
      myVote: myVote ? { entry_id: myVote.entry_id } : null,
      gallery,
      results,
      totalVotes,
      participants,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
