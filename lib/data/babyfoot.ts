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
  forfeited: boolean;                // forfait : hors barème (0 point) et hors qualification
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
      .select("id, team_id, kind, p1_user_id, p2_user_id, p2_is_helper, display_name, registered_by, pool_label, seed, final_rank, forfeited, created_at, team:teams!team_id(id, name)")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true }),
    admin.from("babyfoot_entry_availability").select("entry_id, slot_key"),
  ]);
  const entries = (entriesRaw ?? []) as Array<{
    id: string; team_id: string | null; kind: string | null; p1_user_id: string | null; p2_user_id: string | null;
    p2_is_helper: boolean | null;
    display_name: string | null; registered_by: string | null;
    pool_label: string | null; seed: number | null; final_rank: number | null; forfeited: boolean | null; created_at: string;
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
    // Une paire ad-hoc n'affiche que les prénoms… sauf si elle s'est choisi un
    // nom de binôme (ex. une paire née d'une équipe existante) : on le garde.
    const generic = (isOpen && !e.display_name) || bname === names || /^bin[oô]mes?$/i.test(bname.trim()) || names.toLowerCase().includes(bname.toLowerCase());
    const label = !generic ? `${bname} · ${names}` : names;
    return {
      id: e.id, team_id: e.team_id ?? "", team_name: teamName,
      kind: (isOpen ? "open" : "official") as "official" | "open", p2_is_helper: helper,
      display_name: e.display_name, label, members: mem,
      pool_label: e.pool_label, seed: e.seed, final_rank: e.final_rank,
      forfeited: !!e.forfeited,
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
  forfeited: boolean;
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
    entries.map((e) => ({ id: e.id, team_id: e.team_id, forfeited: e.forfeited })),
    matches, 4
  );
  const classement: ClassementRow[] = champ.map((r) => ({
    rank: r.rank, entry_id: r.entry_id, team_id: r.team_id, label: labelByEntry.get(r.entry_id) ?? "?",
    played: r.played, won: r.won, lost: r.lost, gf: r.gf, ga: r.ga, gd: r.gd, qualified: r.qualified,
    forfeited: r.forfeited,
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

// ── Bannière d'accueil : où en sont les inscriptions ? ───────────────────────
// « 🏓 8 binômes inscrits · Plus que 4 places · Il reste 2 jours » — l'urgence
// qui fait cliquer. null si pas de tournoi actif ou inscriptions fermées.
export async function getBabyfootRegistrationSnapshot(): Promise<{
  count: number; target: number; remaining: number; deadlineLabel: string;
} | null> {
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t || !t.registration_open) return null;
  const { count } = await admin
    .from("babyfoot_entries").select("id", { count: "exact", head: true })
    .eq("tournament_id", t.id);
  const { BABYFOOT } = await import("@/lib/config/babyfoot");
  const msLeft = new Date(BABYFOOT.inscriptionsCloseAt).getTime() - Date.now();
  const days = Math.ceil(msLeft / 86_400_000);
  const deadlineLabel =
    msLeft <= 0 ? "⏰ Clôture imminente !"
    : days <= 1 ? "⏰ Dernier jour pour s'inscrire !"
    : `⏰ Il reste ${days} jours`;
  const n = count ?? 0;
  return { count: n, target: t.target_teams, remaining: Math.max(0, t.target_teams - n), deadlineLabel };
}

// ── Carte d'accueil « où en est mon binôme » ────────────────────────────────
// 4 états racontés sur la home : en création → inscrit → tirage → prochain match.
// null = pas de tournoi / joueur non inscrit (la home garde alors le CTA
// d'inscription générique). authId = auth.users.id.
export async function getBabyfootHomeCard(authId: string): Promise<{
  partnerName: string | null;
  entryLabel: string;
  state: "registered" | "draw" | "live";
  nextMatch: { opponentLabel: string; startsAt: string | null; tableNo: number | null } | null;
} | null> {
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) return null;
  const binome = await resolveUserBinome(admin, authId);
  if (!binome) return null;
  const participants = await getRealParticipants(admin, t.id);
  const mine = participants.get(binome.meId);
  if (!mine) return null; // non inscrit → pas de carte binôme
  const bc = await getEntryBinomeContext(admin, mine.entryId, binome.meId);
  let state: "registered" | "draw" | "live" = "registered";
  let nextMatch: Awaited<ReturnType<typeof getNextEntryMatch>> = null;
  if (t.status === "pools" || t.status === "knockout") {
    state = "live";
    nextMatch = await getNextEntryMatch(admin, t.id, mine.entryId);
  } else if (t.status === "draw") {
    state = "draw";
  }
  return {
    partnerName: bc?.partnerName ?? null,
    entryLabel: mine.label,
    state,
    nextMatch: nextMatch
      ? { opponentLabel: nextMatch.opponentLabel, startsAt: nextMatch.startsAt, tableNo: nextMatch.tableNo }
      : null,
  };
}

// ── Bannière d'accueil « Top 4 qualifié » ────────────────────────────────────
// Visible par TOUT LE MONDE entre la fin du championnat et la fin du tournoi :
// félicite les 4 qualifiés et annonce les demies qui s'enchaînent. Personnalisée
// si le binôme du visiteur est du lot. Retourne null tant que le championnat
// n'est pas terminé (ou une fois le tournoi fini : le podium prend le relais).
export async function getBabyfootQualifiedBanner(authId: string): Promise<{
  labels: string[];
  mine: boolean;
  nextStartsAt: string | null;
} | null> {
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t || t.status === "finished") return null;

  const matches = await getMatches(admin, t.id);
  const league = matches.filter((m) => m.phase === "league");
  if (!league.length || !league.every((m) => m.status === "finished")) return null;

  const entries = await getEntries(admin, t.id);
  const [{ computeChampionshipStandings }, { BABYFOOT }] = await Promise.all([
    import("@/lib/babyfoot/standings"),
    import("@/lib/config/babyfoot"),
  ]);
  const champ = computeChampionshipStandings(
    entries.map((e) => ({ id: e.id, team_id: e.team_id, forfeited: e.forfeited })),
    matches, BABYFOOT.qualifiers
  );
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const qualified = champ.filter((s) => s.qualified);
  if (!qualified.length) return null;

  const binome = await resolveUserBinome(admin, authId);
  const mineEntryId = binome ? (await getRealParticipants(admin, t.id)).get(binome.meId)?.entryId ?? null : null;

  const nextStartsAt = matches
    .filter((m) => m.phase && m.phase !== "league" && m.status !== "finished" && m.starts_at)
    .map((m) => m.starts_at!)
    .sort()[0] ?? null;

  return {
    labels: qualified.map((s) => labelByEntry.get(s.entry_id) ?? "?"),
    mine: !!mineEntryId && qualified.some((s) => s.entry_id === mineEntryId),
    nextStartsAt,
  };
}

// ── Participants RÉELS d'une édition ─────────────────────────────────────────
// user_id → son inscription effective. Officiel = les 2 membres de l'équipe ;
// paire ad-hoc = p1 toujours, p2 SEULEMENT s'il n'est pas renfort (un renfort
// n'est pas un « deuxième participant officiel » : il reste libre/inscrit ailleurs).
export async function getRealParticipants(
  admin: DbClient,
  tournamentId: string
): Promise<Map<string, { entryId: string; label: string }>> {
  const [entries, { data: rawRows }] = await Promise.all([
    getEntries(admin, tournamentId),
    admin.from("babyfoot_entries")
      .select("id, kind, team_id, p1_user_id, p2_user_id, p2_is_helper")
      .eq("tournament_id", tournamentId),
  ]);
  const labelById = new Map(entries.map((e) => [e.id, e.label]));
  const rows = (rawRows ?? []) as Array<{ id: string; kind: string | null; team_id: string | null; p1_user_id: string | null; p2_user_id: string | null; p2_is_helper: boolean | null }>;
  const out = new Map<string, { entryId: string; label: string }>();
  const officialTeams = rows.filter((r) => r.kind !== "open" && r.team_id).map((r) => r.team_id!);
  if (officialTeams.length) {
    const { data: tm } = await admin.from("team_memberships").select("team_id, user_id").in("team_id", officialTeams);
    const entryByTeam = new Map(rows.filter((r) => r.kind !== "open" && r.team_id).map((r) => [r.team_id!, r.id]));
    for (const m of (tm ?? []) as { team_id: string; user_id: string }[]) {
      const eid = entryByTeam.get(m.team_id);
      if (eid) out.set(m.user_id, { entryId: eid, label: labelById.get(eid) ?? "?" });
    }
  }
  for (const r of rows) {
    if (r.kind !== "open") continue;
    if (r.p1_user_id) out.set(r.p1_user_id, { entryId: r.id, label: labelById.get(r.id) ?? "?" });
    if (r.p2_user_id && !r.p2_is_helper) out.set(r.p2_user_id, { entryId: r.id, label: labelById.get(r.id) ?? "?" });
  }
  return out;
}

// ── Contexte « page binôme » ─────────────────────────────────────────────────
// Pour une inscription donnée + le user courant : qui l'a créée, qui a saisi les
// créneaux en dernier, qui est le coéquipier (et son auth_id, pour le notifier).
// Sépare proprement l'INSCRIPTION (créateur / créneaux) du rôle de RENFORT.
export interface EntryBinomeContext {
  entryId: string;
  kind: "official" | "open";
  creatorId: string | null;
  creatorName: string | null;
  iAmCreator: boolean;
  slotsAuthorId: string | null;
  slotsAuthorName: string | null;
  iAmSlotsAuthor: boolean;
  slotsUpdatedAt: string | null;
  partnerUserId: string | null;
  partnerName: string | null;
  partnerAuthId: string | null;
  iAmHelperPartner: boolean; // true si MON coéquipier est un renfort (il dépanne)
}

export async function getEntryBinomeContext(
  admin: DbClient,
  entryId: string,
  meId: string
): Promise<EntryBinomeContext | null> {
  const { data: e } = await admin
    .from("babyfoot_entries")
    .select("id, kind, team_id, p1_user_id, p2_user_id, p2_is_helper, registered_by, slots_updated_by, slots_updated_at")
    .eq("id", entryId)
    .maybeSingle();
  if (!e) return null;

  const isOpen = e.kind === "open";
  // Les deux joueurs RÉELS de l'inscription.
  let memberIds: string[] = [];
  if (isOpen) {
    memberIds = [e.p1_user_id, e.p2_user_id].filter((x): x is string => !!x);
  } else if (e.team_id) {
    const { data: tm } = await admin.from("team_memberships").select("user_id").eq("team_id", e.team_id);
    memberIds = (tm ?? []).map((r: { user_id: string }) => r.user_id);
  }
  const partnerUserId = memberIds.find((id) => id !== meId) ?? null;

  const wanted = [e.registered_by, e.slots_updated_by, partnerUserId].filter((x): x is string => !!x);
  const nameById = new Map<string, string>();
  const authById = new Map<string, string | null>();
  if (wanted.length) {
    const { data: us } = await admin
      .from("users").select("id, display_name, name, auth_id").in("id", [...new Set(wanted)]);
    for (const u of (us ?? []) as { id: string; display_name: string | null; name: string | null; auth_id: string | null }[]) {
      nameById.set(u.id, u.display_name || u.name || "—");
      authById.set(u.id, u.auth_id);
    }
  }

  const slotsAuthorId = e.slots_updated_by ?? e.registered_by ?? null;
  // Un renfort (p2_is_helper) est le coéquipier de p1 mais ne « possède » pas
  // l'inscription : si JE suis p1, mon coéquipier affiché est le renfort.
  const iAmHelperPartner = isOpen && !!e.p2_is_helper && e.p1_user_id === meId;

  return {
    entryId: e.id,
    kind: (isOpen ? "open" : "official") as "official" | "open",
    creatorId: e.registered_by ?? null,
    creatorName: e.registered_by ? nameById.get(e.registered_by) ?? null : null,
    iAmCreator: e.registered_by === meId,
    slotsAuthorId,
    slotsAuthorName: slotsAuthorId ? nameById.get(slotsAuthorId) ?? null : null,
    iAmSlotsAuthor: slotsAuthorId === meId,
    slotsUpdatedAt: e.slots_updated_at ?? null,
    partnerUserId,
    partnerName: partnerUserId ? nameById.get(partnerUserId) ?? null : null,
    partnerAuthId: partnerUserId ? authById.get(partnerUserId) ?? null : null,
    iAmHelperPartner,
  };
}

/** Notifie UN joueur baby-foot (inbox + push). userId = public users.id. */
export async function notifyBabyfootUser(
  admin: DbClient,
  userId: string,
  n: { title: string; message: string; url?: string }
): Promise<void> {
  const { createInboxEvent } = await import("@/lib/data/inbox");
  await createInboxEvent({ userId, type: "babyfoot", title: n.title, message: n.message });
  // Push best-effort (nécessite l'auth_id du joueur).
  const { data: u } = await admin.from("users").select("auth_id").eq("id", userId).maybeSingle();
  if (u?.auth_id) {
    const { sendPushToUser } = await import("@/lib/push");
    await sendPushToUser(u.auth_id, { title: n.title, body: n.message, url: n.url ?? "/babyfoot/register" });
  }
}

// ── Disponibilités PAR JOUEUR + intersection ─────────────────────────────────
// babyfoot_player_availability = ce que CHAQUE joueur a coché. L'effectif du
// binôme (babyfoot_entry_availability, lu par le moteur) = INTERSECTION des
// joueurs qui ont saisi quelque chose. Un joueur sans saisie ne contraint pas
// (l'autre peut inscrire le binôme seul, comme avant).

/** user_ids des joueurs RÉELS d'une inscription (renfort exclu). */
export async function getEntryRealPlayerIds(admin: DbClient, entryId: string): Promise<string[]> {
  const { data: e } = await admin
    .from("babyfoot_entries")
    .select("kind, team_id, p1_user_id, p2_user_id, p2_is_helper")
    .eq("id", entryId).maybeSingle();
  if (!e) return [];
  if (e.kind === "open") {
    const ids = [e.p1_user_id];
    if (!e.p2_is_helper) ids.push(e.p2_user_id);
    return ids.filter((x): x is string => !!x);
  }
  if (e.team_id) {
    const { data: tm } = await admin.from("team_memberships").select("user_id").eq("team_id", e.team_id);
    return ((tm ?? []) as { user_id: string }[]).map((r) => r.user_id);
  }
  return [];
}

/** Recalcule l'effectif (intersection) et réécrit babyfoot_entry_availability. */
export async function recomputeEntryAvailability(admin: DbClient, entryId: string): Promise<string[]> {
  const players = new Set(await getEntryRealPlayerIds(admin, entryId));
  const { data: rows } = await admin
    .from("babyfoot_player_availability").select("user_id, slot_key").eq("entry_id", entryId);
  const byUser = new Map<string, Set<string>>();
  for (const r of (rows ?? []) as { user_id: string; slot_key: string }[]) {
    if (!players.has(r.user_id)) continue;
    if (!byUser.has(r.user_id)) byUser.set(r.user_id, new Set());
    byUser.get(r.user_id)!.add(r.slot_key);
  }
  const constrainers = [...byUser.values()].filter((s) => s.size > 0);
  let effective: string[] = [];
  if (constrainers.length) {
    effective = [...constrainers[0]].filter((k) => constrainers.every((s) => s.has(k)));
  }
  await admin.from("babyfoot_entry_availability").delete().eq("entry_id", entryId);
  if (effective.length) {
    await admin.from("babyfoot_entry_availability")
      .insert(effective.map((slot_key) => ({ entry_id: entryId, slot_key })));
  }
  return effective;
}

export interface BinomeAvailability {
  mySlots: string[];        // MES créneaux (à pré-remplir dans l'éditeur)
  partnerSlots: string[];   // ceux du coéquipier ([] s'il n'a rien saisi)
  partnerHasSet: boolean;   // le coéquipier a-t-il renseigné ses dispos ?
  commonSlots: string[];    // intersection = créneaux jouables ensemble (= effectif)
  iHaveSet: boolean;
}

export async function getBinomeAvailability(
  admin: DbClient,
  entryId: string,
  meId: string,
  partnerUserId: string | null
): Promise<BinomeAvailability> {
  const { data: rows } = await admin
    .from("babyfoot_player_availability").select("user_id, slot_key").eq("entry_id", entryId);
  const mine = new Set<string>();
  const partner = new Set<string>();
  for (const r of (rows ?? []) as { user_id: string; slot_key: string }[]) {
    if (r.user_id === meId) mine.add(r.slot_key);
    else if (partnerUserId && r.user_id === partnerUserId) partner.add(r.slot_key);
  }
  const partnerHasSet = partner.size > 0;
  const commonSlots = partnerHasSet
    ? [...mine].filter((k) => partner.has(k))
    : [...mine]; // coéquipier non contraignant → jouable = mes créneaux
  return {
    mySlots: [...mine],
    partnerSlots: [...partner],
    partnerHasSet,
    commonSlots,
    iHaveSet: mine.size > 0,
  };
}

// ── Prochain match d'une inscription (pour la carte d'accueil « binôme ») ──────
export async function getNextEntryMatch(
  admin: DbClient,
  tournamentId: string,
  entryId: string
): Promise<{ id: string; startsAt: string | null; opponentLabel: string; tableNo: number | null } | null> {
  const matches = await getMatches(admin, tournamentId);
  const entries = await getEntries(admin, tournamentId);
  const labelByEntry = new Map(entries.map((e) => [e.id, e.label]));
  const mine = matches
    .filter((m) => (m.entry_a_id === entryId || m.entry_b_id === entryId) && m.status !== "finished")
    .sort((a, b) => {
      const ta = a.starts_at ? new Date(a.starts_at).getTime() : Infinity;
      const tb = b.starts_at ? new Date(b.starts_at).getTime() : Infinity;
      return ta - tb || (a.order_idx ?? 0) - (b.order_idx ?? 0);
    });
  const m = mine[0];
  if (!m) return null;
  const oppId = m.entry_a_id === entryId ? m.entry_b_id : m.entry_a_id;
  return {
    id: m.id,
    startsAt: m.starts_at ?? null,
    opponentLabel: (oppId && labelByEntry.get(oppId)) || "à venir",
    tableNo: m.table_no ?? null,
  };
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
