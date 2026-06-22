// GET /api/supporters — état du concours + galerie + ma photo + mon vote.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { PODIUM_POINTS } from "@/lib/supporters/service";
import { isSupportersOrganizer, VOTES_CLOSE_AT, votesClosed, VAR_CATEGORIES } from "@/lib/supporters/access";

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

  const approvedIds = approved.map((e) => e.id);

  // Commentaires groupés par photo (chambrage).
  const commentsByEntry = new Map<string, { id: string; user_id: string | null; display_name: string; body: string; created_at: string }[]>();
  let commentsRaw: { entry_id: string; user_id: string | null }[] = [];
  if (approved.length) {
    const { data: comments } = await admin
      .from("supporter_photo_comments")
      .select("id, entry_id, user_id, display_name, body, created_at")
      .in("entry_id", approvedIds)
      .order("created_at", { ascending: true });
    commentsRaw = (comments ?? []).map((c) => ({ entry_id: c.entry_id, user_id: c.user_id }));
    for (const c of comments ?? []) {
      const arr = commentsByEntry.get(c.entry_id) ?? [];
      arr.push({ id: c.id, user_id: c.user_id, display_name: c.display_name, body: c.body, created_at: c.created_at });
      commentsByEntry.set(c.entry_id, arr);
    }
  }

  // Réactions emoji groupées par photo (compteurs + mes réactions).
  const reactionsByEntry = new Map<string, Record<string, number>>();
  const myReactionsByEntry = new Map<string, string[]>();
  let reactionsRaw: { entry_id: string; user_id: string | null; emoji: string; created_at?: string }[] = [];
  if (approved.length) {
    const { data: reactions } = await admin
      .from("supporter_photo_reactions")
      .select("entry_id, user_id, emoji, created_at")
      .in("entry_id", approvedIds);
    reactionsRaw = reactions ?? [];
    for (const r of reactions ?? []) {
      const counts = reactionsByEntry.get(r.entry_id) ?? {};
      counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
      reactionsByEntry.set(r.entry_id, counts);
      if (r.user_id === me.id) {
        const mine = myReactionsByEntry.get(r.entry_id) ?? [];
        mine.push(r.emoji);
        myReactionsByEntry.set(r.entry_id, mine);
      }
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
    reactions: reactionsByEntry.get(e.id) ?? {},
    my_reactions: myReactionsByEntry.get(e.id) ?? [],
  }));

  // 🏆 Prix VAR AUTO — gagnant par catégorie dérivé des réactions/commentaires,
  // self-réactions/auto-commentaires EXCLUS. Aperçu live aux organisateurs,
  // visible par tous après le reveal (results_published).
  let varAwards:
    | { key: string; emoji: string; label: string; team_name: string; photo_url: string; title: string | null; count: number }[]
    | null = null;
  if ((isOrganizer || resultsPublished) && approved.length) {
    const { data: allUsersTeam } = await admin.from("users").select("id, team_id");
    const userTeam = new Map((allUsersTeam ?? []).map((u: { id: string; team_id: string | null }) => [u.id, u.team_id]));
    const entryTeam = new Map(approved.map((e) => [e.id, e.team_id]));
    const meta = new Map(approved.map((e) => [e.id, { team_name: teamName.get(e.team_id) ?? "Binôme", photo_url: e.photo_url, title: e.title }]));

    const reactCount = new Map<string, Record<string, number>>();
    for (const r of reactionsRaw) {
      if (r.user_id && userTeam.get(r.user_id) === entryTeam.get(r.entry_id)) continue; // self
      const m = reactCount.get(r.entry_id) ?? {};
      m[r.emoji] = (m[r.emoji] ?? 0) + 1;
      reactCount.set(r.entry_id, m);
    }
    const commentCount = new Map<string, number>();
    for (const c of commentsRaw) {
      if (c.user_id && userTeam.get(c.user_id) === entryTeam.get(c.entry_id)) continue; // self
      commentCount.set(c.entry_id, (commentCount.get(c.entry_id) ?? 0) + 1);
    }

    varAwards = [];
    for (const cat of VAR_CATEGORIES) {
      let bestId: string | null = null;
      let bestN = 0;
      for (const e of approved) {
        const n = cat.source === "comments" ? commentCount.get(e.id) ?? 0 : reactCount.get(e.id)?.[cat.emoji] ?? 0;
        if (n > bestN) { bestN = n; bestId = e.id; }
      }
      if (bestId && bestN > 0) {
        const m = meta.get(bestId)!;
        varAwards.push({ key: cat.key, emoji: cat.emoji, label: cat.label, team_name: m.team_name, photo_url: m.photo_url, title: m.title, count: bestN });
      }
    }
  }

  // Stats de participation PUBLIQUES (pression sociale, counts seulement) +
  // liste détaillée réservée aux organisateurs.
  const [{ data: allUsers }, { data: allVoteRows }] = await Promise.all([
    admin.from("users").select("id, display_name, name, team_id").eq("profile_completed", true),
    admin.from("supporter_photo_votes").select("voter_user_id, created_at"),
  ]);
  const voters = new Set((allVoteRows ?? []).map((v) => v.voter_user_id));
  const participantsCount = (allUsers ?? []).length;
  const teamsWithPlayers = new Set((allUsers ?? []).map((u) => u.team_id).filter(Boolean));
  const daysLeft = Math.max(0, Math.ceil((new Date(VOTES_CLOSE_AT).getTime() - Date.now()) / 86400000));
  const stats = {
    photos: approved.length,
    teams: teamsWithPlayers.size,
    voters: voters.size,
    participants: participantsCount,
    nonVoters: Math.max(0, participantsCount - voters.size),
    daysLeft,
  };

  // Onglet organisateur « N'ont pas voté » : joueurs inscrits + binôme + statut.
  let participants: { name: string; teamName: string | null; voted: boolean }[] | null = null;
  // Radar d'animation (réservé Marie/Vincent) : données -> DÉCISION (relancer ?
  // pousser un rappel ?). Pas un tableau de bord, un signal + une action.
  let radar: {
    temperature: "faible" | "normale" | "tres_active";
    today: { photos: number; reactions: number; comments: number; votes: number };
    teamsTotal: number;
    postedCount: number;
    notPostedTeams: string[];
    nonVoters: number;
  } | null = null;
  if (isOrganizer) {
    participants = (allUsers ?? [])
      .map((u) => ({
        name: u.display_name || u.name || "Joueur",
        teamName: u.team_id ? teamName.get(u.team_id) ?? null : null,
        voted: voters.has(u.id),
      }))
      .sort((a, b) => Number(a.voted) - Number(b.voted) || a.name.localeCompare(b.name));

    // Activité des dernières 24 h (proxy « aujourd'hui », sans souci de fuseau).
    const since = Date.now() - 86400000;
    const recent = (iso?: string | null) => !!iso && new Date(iso).getTime() >= since;
    const todayPhotos = approved.filter((e) => recent(e.created_at as string)).length;
    const todayReactions = reactionsRaw.filter((r) => recent(r.created_at)).length;
    let todayComments = 0;
    for (const list of commentsByEntry.values()) for (const c of list) if (recent(c.created_at)) todayComments++;
    const todayVotes = (allVoteRows ?? []).filter((v) => recent((v as { created_at?: string }).created_at)).length;

    const postedTeamIds = new Set(approved.map((e) => e.team_id));
    const notPostedTeams = [...teamsWithPlayers]
      .filter((tid): tid is string => !!tid && !postedTeamIds.has(tid))
      .map((tid) => teamName.get(tid) ?? "Binôme");

    const score = todayPhotos * 3 + todayReactions + todayComments * 2 + todayVotes;
    const temperature = score >= 30 ? "tres_active" : score >= 10 ? "normale" : "faible";

    radar = {
      temperature,
      today: { photos: todayPhotos, reactions: todayReactions, comments: todayComments, votes: todayVotes },
      teamsTotal: teamsWithPlayers.size,
      postedCount: postedTeamIds.size,
      notPostedTeams,
      nonVoters: Math.max(0, participantsCount - voters.size),
    };
  }

  // 🔴 Flux d'activité : publications + réactions + commentaires, du plus récent.
  // Dérivé des created_at existants (aucune table dédiée).
  const userName = new Map((allUsers ?? []).map((u) => [u.id, u.display_name || u.name || "Quelqu'un"]));
  const entryTeamName = new Map(approved.map((e) => [e.id, teamName.get(e.team_id) ?? "un binôme"]));
  type Act = { kind: "photo" | "reaction" | "comment"; at: string; actor: string; team: string; emoji?: string };
  const activityRaw: Act[] = [];
  for (const e of approved) {
    activityRaw.push({ kind: "photo", at: e.created_at as string, actor: teamName.get(e.team_id) ?? "Un binôme", team: teamName.get(e.team_id) ?? "un binôme" });
  }
  for (const r of reactionsRaw) {
    if (!r.created_at) continue;
    activityRaw.push({ kind: "reaction", at: r.created_at, actor: r.user_id ? userName.get(r.user_id) ?? "Quelqu'un" : "Quelqu'un", team: entryTeamName.get(r.entry_id) ?? "un binôme", emoji: r.emoji });
  }
  for (const [entryId, list] of commentsByEntry) {
    for (const c of list) {
      activityRaw.push({ kind: "comment", at: c.created_at, actor: c.display_name, team: entryTeamName.get(entryId) ?? "un binôme" });
    }
  }
  const activity = activityRaw
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 25);

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
      varAwards,
      stats,
      activity,
      radar,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
