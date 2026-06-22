// Données TV de la Journée Supporters (écran public, sans auth — via service).
//  Avant reveal : photos + réactions (hype).  Après reveal (results_published) :
//  + votes, Prix VAR et podium pour la cérémonie.
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { VAR_CATEGORIES } from "@/lib/supporters/access";
import { PODIUM_POINTS } from "@/lib/supporters/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = createAdminClient();

  const [{ data: settings }, { data: entries }, { data: teams }, { data: reactions }, { data: comments }, { data: votes }, { data: users }] =
    await Promise.all([
      admin.from("supporter_settings").select("results_published").eq("id", 1).maybeSingle(),
      admin.from("supporter_photo_entries").select("id, team_id, title, photo_url, media_type, status, podium_rank").eq("status", "approved"),
      admin.from("teams").select("id, name"),
      admin.from("supporter_photo_reactions").select("entry_id, user_id, emoji"),
      admin.from("supporter_photo_comments").select("entry_id, user_id"),
      admin.from("supporter_photo_votes").select("entry_id"),
      admin.from("users").select("id, team_id"),
    ]);

  const revealed = !!settings?.results_published;
  const teamName = new Map((teams ?? []).map((t: { id: string; name: string }) => [t.id, t.name]));
  const userTeam = new Map((users ?? []).map((u: { id: string; team_id: string | null }) => [u.id, u.team_id]));
  const approved = entries ?? [];
  const entryTeam = new Map(approved.map((e) => [e.id, e.team_id]));

  // Réactions par photo (publiques), + compteurs hors self pour les Prix VAR.
  const reactByEntry = new Map<string, Record<string, number>>();
  const reactByEntryNoSelf = new Map<string, Record<string, number>>();
  for (const r of reactions ?? []) {
    const all = reactByEntry.get(r.entry_id) ?? {};
    all[r.emoji] = (all[r.emoji] ?? 0) + 1;
    reactByEntry.set(r.entry_id, all);
    if (r.user_id && userTeam.get(r.user_id) === entryTeam.get(r.entry_id)) continue;
    const ns = reactByEntryNoSelf.get(r.entry_id) ?? {};
    ns[r.emoji] = (ns[r.emoji] ?? 0) + 1;
    reactByEntryNoSelf.set(r.entry_id, ns);
  }
  const commentNoSelf = new Map<string, number>();
  for (const c of comments ?? []) {
    if (c.user_id && userTeam.get(c.user_id) === entryTeam.get(c.entry_id)) continue;
    commentNoSelf.set(c.entry_id, (commentNoSelf.get(c.entry_id) ?? 0) + 1);
  }
  const voteCount = new Map<string, number>();
  for (const v of votes ?? []) voteCount.set(v.entry_id, (voteCount.get(v.entry_id) ?? 0) + 1);

  const photos = approved.map((e) => ({
    id: e.id,
    team_name: teamName.get(e.team_id) ?? "Binôme",
    title: e.title,
    photo_url: e.photo_url,
    media_type: e.media_type ?? "image",
    reactions: reactByEntry.get(e.id) ?? {},
    votes: revealed ? voteCount.get(e.id) ?? 0 : null,
  }));

  // Prix VAR + podium : seulement au reveal (cérémonie).
  let varAwards: { emoji: string; label: string; team_name: string; photo_url: string; count: number }[] = [];
  let podium: { rank: number; team_name: string; title: string | null; photo_url: string; votes: number; points: number }[] = [];
  if (revealed) {
    for (const cat of VAR_CATEGORIES) {
      let bestId: string | null = null;
      let bestN = 0;
      for (const e of approved) {
        const n = cat.source === "comments" ? commentNoSelf.get(e.id) ?? 0 : reactByEntryNoSelf.get(e.id)?.[cat.emoji] ?? 0;
        if (n > bestN) { bestN = n; bestId = e.id; }
      }
      if (bestId && bestN > 0) {
        const e = approved.find((x) => x.id === bestId)!;
        varAwards.push({ emoji: cat.emoji, label: cat.label, team_name: teamName.get(e.team_id) ?? "Binôme", photo_url: e.photo_url, count: bestN });
      }
    }
    podium = approved
      .filter((e) => e.podium_rank)
      .sort((a, b) => (a.podium_rank ?? 9) - (b.podium_rank ?? 9))
      .map((e) => ({
        rank: e.podium_rank as number,
        team_name: teamName.get(e.team_id) ?? "Binôme",
        title: e.title,
        photo_url: e.photo_url,
        votes: voteCount.get(e.id) ?? 0,
        points: PODIUM_POINTS[e.podium_rank as number] ?? 0,
      }));
  }

  return NextResponse.json(
    { revealed, photos, varAwards, podium },
    { headers: { "Cache-Control": "no-store" } }
  );
}
