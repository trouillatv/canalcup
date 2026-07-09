// Accès données du Tournoi Baby-foot — helpers partagés (inscription, admin,
// hub public, TV). Client ADMIN (service role) : lectures cross-RLS + écritures.
// Un binôme = une équipe CanalCup (teams) de 2 joueurs.

import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import type {
  BabyfootTournament, BabyFootMatch, BabyfootAward,
} from "@/lib/supabase/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbClient = any;

export interface BabyfootEntryView {
  id: string;
  team_id: string;
  team_name: string;
  kind: "official" | "open";         // interne — JAMAIS affiché tel quel (UI : « Paire Baby-foot »)
  p2_is_helper: boolean;             // paire ad-hoc avec renfort : seul p1 marque
  display_name: string | null;      // nom de binôme choisi, ou null
  label: string;                     // ce qu'on AFFICHE (display_name ou "A & B" ou "A + B en renfort")
  members: string[];                 // prénoms/pseudos des 2 joueurs
  pool_label: string | null;
  seed: number | null;
  final_rank: number | null;
  availability: string[];            // slot_keys cochés
  registered_by: string | null;
  created_at: string;
}

/** L'édition officielle en cours (celle qui compte au classement). */
export async function getActiveOfficialTournament(admin?: DbClient): Promise<BabyfootTournament | null> {
  const db = admin ?? createAdminClient();
  const { data } = await db
    .from("babyfoot_tournaments")
    .select("*")
    .eq("kind", "official")
    .eq("is_active", true)
    .maybeSingle();
  return (data as BabyfootTournament) ?? null;
}

/** team_id → prénoms/pseudos des membres (pour "Vincent & Thomas"). */
export async function getTeamMembersMap(admin: DbClient, teamIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!teamIds.length) return out;
  const memberships = await selectAll<{ user_id: string; team_id: string }>(
    admin, "team_memberships", "user_id, team_id"
  );
  const users = await selectAll<{ id: string; display_name: string | null; name: string | null }>(
    admin, "users", "id, display_name, name"
  );
  const nameById = new Map((users ?? []).map((u) => [u.id, u.display_name || u.name || "—"]));
  const wanted = new Set(teamIds);
  for (const m of memberships ?? []) {
    if (!wanted.has(m.team_id)) continue;
    const nm = nameById.get(m.user_id);
    if (!nm) continue;
    if (!out.has(m.team_id)) out.set(m.team_id, []);
    out.get(m.team_id)!.push(nm);
  }
  return out;
}

/** Inscriptions (binômes) d'une édition, enrichies équipe + membres + dispos. */
export async function getEntries(admin: DbClient, tournamentId: string): Promise<BabyfootEntryView[]> {
  const [{ data: entriesRaw }, { data: availRaw }] = await Promise.all([
    admin
      .from("babyfoot_entries")
      .select("id, team_id, kind, p1_user_id, p2_user_id, p2_is_helper, display_name, registered_by, pool_label, seed, final_rank, created_at, team:teams!team_id(id, name)")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true }),
    admin.from("babyfoot_entry_availability").select("entry_id, slot_key"),
  ]);
  const entries = (entriesRaw ?? []) as Array<{
    id: string; team_id: string | null; kind: string | null; p1_user_id: string | null; p2_user_id: string | null;
    p2_is_helper: boolean | null;
    display_name: string | null; registered_by: string | null;
    pool_label: string | null; seed: number | null; final_rank: number | null; created_at: string;
    team: { id: string; name: string } | null;
  }>;
  const avail = (availRaw ?? []) as Array<{ entry_id: string; slot_key: string }>;
  const availByEntry = new Map<string, string[]>();
  for (const a of avail) {
    if (!availByEntry.has(a.entry_id)) availByEntry.set(a.entry_id, []);
    availByEntry.get(a.entry_id)!.push(a.slot_key);
  }
  const members = await getTeamMembersMap(admin, entries.map((e) => e.team_id).filter((x): x is string => !!x));
  // Noms des joueurs des paires ad-hoc (kind='open').
  const openUserIds = entries.flatMap((e) => (e.kind === "open" ? [e.p1_user_id, e.p2_user_id] : [])).filter((x): x is string => !!x);
  const openNames = new Map<string, string>();
  if (openUserIds.length) {
    const { data: us } = await admin.from("users").select("id, display_name, name").in("id", [...new Set(openUserIds)]);
    for (const u of (us ?? []) as { id: string; display_name: string | null; name: string | null }[]) openNames.set(u.id, u.display_name || u.name || "—");
  }

  return entries.map((e) => {
    const isOpen = e.kind === "open";
    const helper = isOpen && !!e.p2_is_helper;
    const mem = isOpen
      ? [e.p1_user_id, e.p2_user_id].filter((x): x is string => !!x).map((id) => openNames.get(id) ?? "—")
      : (e.team_id ? members.get(e.team_id) ?? [] : []);
    const teamName = e.team?.name ?? "Binôme";
    // Renfort : « Vincent + Jeff en renfort » (tout le monde voit qui joue, seul
    // Vincent marque). Paire ad-hoc normale : « Vincent & Julien ».
    const names = helper && mem.length === 2 ? `${mem[0]} + ${mem[1]} en renfort` : mem.length ? mem.join(" & ") : teamName;
    // On affiche le NOM du binôme + les prénoms ("Les Chouchouz · Lili & Killian"),
    // sauf si générique/redondant. Les paires ad-hoc affichent juste les prénoms.
    const bname = e.display_name || (isOpen ? names : teamName);
    const generic = isOpen || bname === names || /^bin[oô]mes?$/i.test(bname.trim()) || names.toLowerCase().includes(bname.toLowerCase());
    const label = !generic ? `${bname} · ${names}` : names;
    return {
      id: e.id, team_id: e.team_id ?? "", team_name: teamName,
      kind: (isOpen ? "open" : "official") as "official" | "open", p2_is_helper: helper,
      display_name: e.display_name, label, members: mem,
      pool_label: e.pool_label, seed: e.seed, final_rank: e.final_rank,
      availability: availByEntry.get(e.id) ?? [],
      registered_by: e.registered_by, created_at: e.created_at,
    };
  });
}

export async function getMatches(admin: DbClient, tournamentId: string): Promise<BabyFootMatch[]> {
  const { data } = await admin
    .from("babyfoot_matches")
    .select("*, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)")
    .eq("tournament_id", tournamentId)
    .order("order_idx", { ascending: true });
  return (data ?? []) as BabyFootMatch[];
}

export async function getAwards(admin: DbClient, tournamentId: string): Promise<BabyfootAward[]> {
  const { data } = await admin
    .from("babyfoot_awards")
    .select("*")
    .eq("tournament_id", tournamentId);
  return (data ?? []) as BabyfootAward[];
}

// ── État public (hub joueur + TV) ────────────────────────────────────────────
export interface PublicMatch {
  id: string;
  phase: string | null;
  round: string | null;
  pool_label: string | null;
  table_no: number | null;
  rotation: number | null;
  starts_at: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
  labelA: string;
  labelB: string;
}
export interface ClassementRow {
  rank: number; entry_id: string; team_id: string; label: string;
  played: number; won: number; lost: number; gf: number; ga: number; gd: number; qualified: boolean;
}

export async function buildPublicState(admin: DbClient, tournamentId: string) {
  const [entries, matches] = await Promise.all([getEntries(admin, tournamentId), getMatches(admin, tournamentId)]);
  const labelByTeam = new Map(entries.map((e) => [e.team_id, e.label]));
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const lblE = (entryId?: string | null) => (entryId ? labelByEntry.get(entryId) ?? "?" : "à venir");

  const publicMatches: PublicMatch[] = matches.map((m) => ({
    id: m.id, phase: m.phase ?? null, round: m.round ?? null, pool_label: m.pool_label ?? null,
    table_no: m.table_no ?? null, rotation: m.rotation ?? null, starts_at: m.starts_at ?? null, status: m.status,
    score_a: m.score_a ?? null, score_b: m.score_b ?? null,
    labelA: lblE(m.entry_a_id), labelB: lblE(m.entry_b_id),
  }));

  // Classement UNIQUE du championnat (victoires → diff → BP → confrontation directe).
  const { computeChampionshipStandings } = await import("@/lib/babyfoot/standings");
  const champ = computeChampionshipStandings(
    entries.map((e) => ({ id: e.id, team_id: e.team_id })),
    matches, 4
  );
  const classement: ClassementRow[] = champ.map((r) => ({
    rank: r.rank, entry_id: r.entry_id, team_id: r.team_id, label: labelByEntry.get(r.entry_id) ?? "?",
    played: r.played, won: r.won, lost: r.lost, gf: r.gf, ga: r.ga, gd: r.gd, qualified: r.qualified,
  }));

  // Points par binôme (barème cumulatif) → utilisé pour le podium TV.
  const awards = await getAwards(admin, tournamentId);
  const ptsByTeam = new Map<string, number>();
  for (const a of awards) ptsByTeam.set(a.team_id, (ptsByTeam.get(a.team_id) ?? 0) + a.points);

  // Podium (rangs finaux 1..3).
  const podium = entries
    .filter((e) => e.final_rank && e.final_rank <= 3)
    .sort((a, b) => (a.final_rank ?? 9) - (b.final_rank ?? 9))
    .map((e) => ({ rank: e.final_rank!, label: e.label, points: ptsByTeam.get(e.team_id) ?? 0 }));

  // Stats par binôme (tous matchs terminés : poules + phase finale).
  const stats = entries.map((e) => {
    let played = 0, won = 0, lost = 0, gf = 0, ga = 0;
    for (const m of matches) {
      if (m.status !== "finished" || m.score_a == null || m.score_b == null) continue;
      const isA = m.team_a_id === e.team_id, isB = m.team_b_id === e.team_id;
      if (!isA && !isB) continue;
      const mine = isA ? m.score_a : m.score_b;
      const theirs = isA ? m.score_b : m.score_a;
      played++; gf += mine!; ga += theirs!;
      if (mine! > theirs!) won++; else lost++;
    }
    return { entry_id: e.id, team_id: e.team_id, label: e.label, played, won, lost, gf, ga, gd: gf - ga, final_rank: e.final_rank };
  });

  // Faits marquants en direct (dérivés des matchs terminés).
  const { computeHighlights } = await import("@/lib/babyfoot/highlights");
  const poolRankByTeam = new Map<string, number>();
  for (const r of champ) poolRankByTeam.set(r.team_id, r.rank);
  const highlights = computeHighlights(matches, { labelByTeam, poolRankByTeam });

  // Photos récentes du tournoi (galerie + moments).
  const { data: photoRows } = await admin
    .from("babyfoot_match_photos")
    .select("id, photo_url, caption, author_name, created_at")
    .eq("tournament_id", tournamentId)
    .eq("status", "visible")
    .order("created_at", { ascending: false })
    .limit(30);
  const photos = (photoRows ?? []) as { id: string; photo_url: string; caption: string | null; author_name: string; created_at: string }[];

  return {
    entries: entries.map((e) => ({ id: e.id, label: e.label, pool_label: e.pool_label, final_rank: e.final_rank })),
    matches: publicMatches, classement, podium, stats, highlights, photos, registeredCount: entries.length,
  };
}

/** Champions des éditions passées (mémoire annuelle). */
export async function getChampionsHistory(admin?: DbClient): Promise<{ season: number; name: string; champion: string | null }[]> {
  const db = admin ?? createAdminClient();
  const { data: tournaments } = await db
    .from("babyfoot_tournaments")
    .select("id, name, season")
    .eq("kind", "official")
    .order("season", { ascending: false });
  const out: { season: number; name: string; champion: string | null }[] = [];
  for (const t of tournaments ?? []) {
    const { data: champ } = await db
      .from("babyfoot_entries")
      .select("team_id, display_name, team:teams!team_id(name)")
      .eq("tournament_id", t.id)
      .eq("final_rank", 1)
      .maybeSingle();
    let label: string | null = null;
    if (champ) {
      const members = await getTeamMembersMap(db, [champ.team_id]);
      label = champ.display_name || (members.get(champ.team_id) ?? []).join(" & ") || (champ.team as { name: string } | null)?.name || null;
    }
    out.push({ season: t.season, name: t.name, champion: label });
  }
  return out;
}

// ── Fiche d'un binôme (mémoire : historique, stats, palmarès) ────────────────
export interface BinomeFiche {
  teamId: string;
  label: string;
  members: string[];
  current: {
    season: number;
    entered: boolean;
    poolLabel: string | null;
    resultLabel: string | null; // Champion / Finaliste / Demi-finaliste / …
    played: number; won: number; lost: number; gf: number; ga: number; gd: number;
    bestWin: { score: string; opponent: string } | null;
    eliminatedBy: string | null;
    availability: string[];
  } | null;
  history: { season: number; name: string; resultLabel: string }[];
}

const rankLabel = (r: number | null | undefined): string => {
  if (r === 1) return "Champion 🏆";
  if (r === 2) return "Finaliste";
  if (r === 3) return "3e place";
  if (r === 4) return "4e place";
  return "Participation";
};

export async function getBinomeFiche(teamId: string, admin?: DbClient): Promise<BinomeFiche | null> {
  const db = admin ?? createAdminClient();
  const { data: team } = await db.from("teams").select("name").eq("id", teamId).maybeSingle();
  if (!team) return null;
  const membersMap = await getTeamMembersMap(db, [teamId]);
  const members = membersMap.get(teamId) ?? [];
  const label = members.length ? members.join(" & ") : team.name;

  // Toutes les éditions où ce binôme s'est engagé.
  const { data: entriesRaw } = await db
    .from("babyfoot_entries")
    .select("id, tournament_id, final_rank, pool_label, tournament:babyfoot_tournaments!tournament_id(season, name, is_active, kind)")
    .eq("team_id", teamId);
  const entries = (entriesRaw ?? []) as Array<{
    id: string; tournament_id: string; final_rank: number | null; pool_label: string | null;
    tournament: { season: number; name: string; is_active: boolean; kind: string } | null;
  }>;

  const history = entries
    .filter((e) => e.tournament && e.tournament.kind === "official" && !e.tournament.is_active)
    .map((e) => ({ season: e.tournament!.season, name: e.tournament!.name, resultLabel: rankLabel(e.final_rank) }))
    .sort((a, b) => b.season - a.season);

  // Édition en cours.
  const activeEntry = entries.find((e) => e.tournament?.is_active);
  let current: BinomeFiche["current"] = null;
  if (activeEntry) {
    const [{ data: matchesRaw }, { data: availRaw }] = await Promise.all([
      db.from("babyfoot_matches")
        .select("id, phase, team_a_id, team_b_id, score_a, score_b, status")
        .eq("tournament_id", activeEntry.tournament_id)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`),
      db.from("babyfoot_entry_availability").select("slot_key").eq("entry_id", activeEntry.id),
    ]);
    const matches = (matchesRaw ?? []) as BabyFootMatch[];
    const otherLabels = await getTeamMembersMap(db, matches.flatMap((m) => [m.team_a_id, m.team_b_id]).filter((x): x is string => !!x && x !== teamId));
    const oppLabel = (id?: string | null) => (id ? (otherLabels.get(id)?.join(" & ") ?? "?") : "?");

    let played = 0, won = 0, lost = 0, gf = 0, ga = 0;
    let bestWin: { score: string; opponent: string } | null = null;
    let bestMargin = 0;
    let eliminatedBy: string | null = null;
    for (const m of matches) {
      if (m.status !== "finished" || m.score_a == null || m.score_b == null) continue;
      const isA = m.team_a_id === teamId;
      const mine = isA ? m.score_a : m.score_b;
      const theirs = isA ? m.score_b : m.score_a;
      const oppId = isA ? m.team_b_id : m.team_a_id;
      played++; gf += mine; ga += theirs;
      if (mine > theirs) {
        won++;
        if (mine - theirs >= bestMargin) { bestMargin = mine - theirs; bestWin = { score: `${mine}-${theirs}`, opponent: oppLabel(oppId) }; }
      } else {
        lost++;
        if (m.phase && m.phase !== "pool") eliminatedBy = oppLabel(oppId); // éliminé en phase finale
      }
    }
    current = {
      season: activeEntry.tournament!.season,
      entered: true,
      poolLabel: activeEntry.pool_label,
      resultLabel: activeEntry.final_rank ? rankLabel(activeEntry.final_rank) : null,
      played, won, lost, gf, ga, gd: gf - ga, bestWin, eliminatedBy,
      availability: (availRaw ?? []).map((a: { slot_key: string }) => a.slot_key),
    };
  }

  return { teamId, label, members, current, history };
}

export interface UserBinome {
  meId: string;
  meName: string;
  teamId: string | null;
  teamName: string | null;
  partnerName: string | null;
  memberCount: number; // nb de joueurs de l'équipe (doit valoir 2 pour s'inscrire)
}

/** Résout le binôme (équipe) du user connecté + le nom du coéquipier. */
export async function resolveUserBinome(admin: DbClient, authId: string): Promise<UserBinome | null> {
  const { data: me } = await admin
    .from("users")
    .select("id, display_name, name, team_id")
    .eq("auth_id", authId)
    .maybeSingle();
  if (!me) return null;
  const meName = me.display_name || me.name || "Moi";
  let teamName: string | null = null;
  let partnerName: string | null = null;
  let memberCount = 0;
  if (me.team_id) {
    const { data: team } = await admin.from("teams").select("name").eq("id", me.team_id).maybeSingle();
    teamName = team?.name ?? null;
    const members = await getTeamMembersMap(admin, [me.team_id]);
    const all = members.get(me.team_id) ?? [];
    memberCount = all.length;
    const names = all.filter((n) => n !== meName);
    partnerName = names[0] ?? null;
  }
  return { meId: me.id, meName, teamId: me.team_id ?? null, teamName, partnerName, memberCount };
}
