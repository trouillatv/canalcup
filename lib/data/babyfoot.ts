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
  display_name: string | null;      // nom de binôme choisi, ou null
  label: string;                     // ce qu'on AFFICHE (display_name ou "A & B" ou nom d'équipe)
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
      .select("id, team_id, display_name, registered_by, pool_label, seed, final_rank, created_at, team:teams!team_id(id, name)")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true }),
    admin.from("babyfoot_entry_availability").select("entry_id, slot_key"),
  ]);
  const entries = (entriesRaw ?? []) as Array<{
    id: string; team_id: string; display_name: string | null; registered_by: string | null;
    pool_label: string | null; seed: number | null; final_rank: number | null; created_at: string;
    team: { id: string; name: string } | null;
  }>;
  const avail = (availRaw ?? []) as Array<{ entry_id: string; slot_key: string }>;
  const availByEntry = new Map<string, string[]>();
  for (const a of avail) {
    if (!availByEntry.has(a.entry_id)) availByEntry.set(a.entry_id, []);
    availByEntry.get(a.entry_id)!.push(a.slot_key);
  }
  const members = await getTeamMembersMap(admin, entries.map((e) => e.team_id));

  return entries.map((e) => {
    const mem = members.get(e.team_id) ?? [];
    const teamName = e.team?.name ?? "Binôme";
    const label = e.display_name || (mem.length ? mem.join(" & ") : teamName);
    return {
      id: e.id, team_id: e.team_id, team_name: teamName,
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

export interface UserBinome {
  meId: string;
  meName: string;
  teamId: string | null;
  teamName: string | null;
  partnerName: string | null;
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
  if (me.team_id) {
    const { data: team } = await admin.from("teams").select("name").eq("id", me.team_id).maybeSingle();
    teamName = team?.name ?? null;
    const members = await getTeamMembersMap(admin, [me.team_id]);
    const names = (members.get(me.team_id) ?? []).filter((n) => n !== meName);
    partnerName = names[0] ?? null;
  }
  return { meId: me.id, meName, teamId: me.team_id ?? null, teamName, partnerName };
}
