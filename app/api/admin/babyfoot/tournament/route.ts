// Pilotage admin du Tournoi Baby-foot (état + machine à états).
//  GET  → état complet pour /admin/babyfoot (édition, binômes+dispos, matchs,
//         awards, projection des deux formats).
//  POST → action ∈ { config, status, registration, generate, generate_ko,
//         publish, recompute, reset, delete_entry, set_table }.
// Auth : isAdminRequest (session cookie ; pas de secret côté client).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { BABYFOOT, slotStartISO } from "@/lib/config/babyfoot";
import {
  getActiveOfficialTournament, getEntries, getMatches, getAwards, getTeamMembersMap,
} from "@/lib/data/babyfoot";
import { projectChampionship } from "@/lib/babyfoot/format";
import { generateChampionship, generateKnockout } from "@/lib/babyfoot/generate";
import { insertGenMatches, type ScheduleSlot } from "@/lib/babyfoot/persist";
import { schedule } from "@/lib/babyfoot/scheduler";
import { computeChampionshipStandings } from "@/lib/babyfoot/standings";
import { planningHealth } from "@/lib/babyfoot/health";
import { recomputeAwards } from "@/lib/babyfoot/awards";

// Dispos par PARTICIPANT (identité = entry_id, pour supporter les paires ad-hoc).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function availabilityMap(entries: any[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const e of entries) { const s = new Set<string>(e.availability ?? []); if (s.size) m.set(e.id, s); }
  return m;
}
// entryId → team_id (null pour les paires ad-hoc) : pour garder team_a/b_id (libellés/stats).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const entryTeamMap = (entries: any[]): Map<string, string | null> =>
  new Map(entries.map((e) => [e.id, e.team_id || null]));
const toScheduleMap = (assignments: { localId: string; rotation: number | null; table_no: number | null; startISO: string | null }[]) =>
  new Map<string, ScheduleSlot>(assignments.map((a) => [a.localId, { rotation: a.rotation, table_no: a.table_no, startISO: a.startISO }]));

const no = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) return NextResponse.json({ error: "Aucune édition active." }, { status: 404 });
  const [entries, matches, awards] = await Promise.all([
    getEntries(admin, t.id), getMatches(admin, t.id), getAwards(admin, t.id),
  ]);
  const projection = projectChampionship(entries.length, {
    tables: t.tables_count, matchMinutes: BABYFOOT.matchMinutes, rotationMinutes: BABYFOOT.rotationMinutes,
    matchesPerTeam: BABYFOOT.matchesPerTeam, qualifiers: BABYFOOT.qualifiers,
  });

  // Santé du planning (dry-run) — recalculée à chaque chargement (= à chaque inscription).
  const health = planningHealth(
    entries.map((e) => ({ team_id: e.id, label: e.label, availability: e.availability })),
    {
      slots: BABYFOOT.slots, matchesPerSlot: BABYFOOT.matchesPerSlot, slotStartISO,
      matchesPerTeam: BABYFOOT.matchesPerTeam, koTarget: t.ko_target,
      minSlots: BABYFOOT.minSlots, slotCap: BABYFOOT.slotRegistrationCap, qualifiers: BABYFOOT.qualifiers,
    }
  );

  // Équipes (binômes CanalCup) pas encore inscrites → pour l'ajout manuel par l'orga.
  const entered = new Set(entries.map((e) => e.team_id));
  const { data: allTeams } = await admin.from("teams").select("id, name");
  const members = await getTeamMembersMap(admin, (allTeams ?? []).map((x: { id: string }) => x.id));
  // Seules les équipes COMPLÈTES (exactement 2 joueurs) et non déjà inscrites
  // sont proposées : la règle "binôme = 2 joueurs" est ainsi respectée dès l'UI
  // (et garantie en base par le trigger babyfoot_entry_validate).
  const availableTeams = (allTeams ?? [])
    .filter((x: { id: string }) => !entered.has(x.id) && (members.get(x.id)?.length ?? 0) === 2)
    .map((x: { id: string; name: string }) => ({ id: x.id, name: x.name, members: members.get(x.id) ?? [] }))
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

  return NextResponse.json({ tournament: t, entries, matches, awards, projection, availableTeams, health }, no);
}

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) return NextResponse.json({ error: "Aucune édition active." }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const action = String(body.action ?? "");

  switch (action) {
    case "config": {
      const patch: Record<string, unknown> = {};
      for (const k of ["name", "event_date", "format", "draw_at", "kickoff_at"] as const) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      for (const k of ["tables_count", "pool_target", "ko_target", "final_target", "target_teams"] as const) {
        if (body[k] !== undefined) patch[k] = Number(body[k]);
      }
      await admin.from("babyfoot_tournaments").update(patch).eq("id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    case "registration": {
      const open = !!body.open;
      await admin.from("babyfoot_tournaments").update({ registration_open: open }).eq("id", t.id);
      return NextResponse.json({ ok: true, registration_open: open }, no);
    }

    case "open_registration": {
      await admin.from("babyfoot_tournaments").update({ registration_open: true, status: "registration" }).eq("id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    case "close_registration": {
      await admin.from("babyfoot_tournaments").update({ registration_open: false, status: "draw" }).eq("id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    case "add_entry": {
      // L'orga inscrit un binôme (équipe) qui ne s'est pas inscrit lui-même.
      const teamId = String(body.team_id ?? "");
      if (!teamId) return NextResponse.json({ error: "team_id requis." }, { status: 400 });
      const { data: existing } = await admin.from("babyfoot_entries").select("id").eq("tournament_id", t.id).eq("team_id", teamId).maybeSingle();
      if (existing) return NextResponse.json({ error: "Binôme déjà inscrit." }, { status: 409 });
      const { error } = await admin.from("babyfoot_entries").insert({ tournament_id: t.id, team_id: teamId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true }, no);
    }

    case "status": {
      const status = String(body.status ?? "");
      const allowed = ["draft", "registration", "draw", "pools", "knockout", "finished"];
      if (!allowed.includes(status)) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
      await admin.from("babyfoot_tournaments").update({ status }).eq("id", t.id);
      // Dès qu'on entre en phase de jeu, on (re)calcule les awards (participation…).
      if (["pools", "knockout", "finished"].includes(status)) await recomputeAwards(admin, t.id);
      return NextResponse.json({ ok: true, status }, no);
    }

    case "generate": {
      // Phase 1 : mini-championnat (3 matchs/binôme) + ordonnancement en rotations.
      // Repart de zéro. NE PUBLIE PAS. Nb de binômes PAIR requis (3 matchs pile).
      const entries = await getEntries(admin, t.id);
      if (entries.length < 4) return NextResponse.json({ error: "Au moins 4 binômes requis." }, { status: 400 });
      if (entries.length % 2 !== 0) {
        return NextResponse.json({ error: `Nombre de binômes IMPAIR (${entries.length}). Ajoute ou retire un binôme pour avoir un nombre pair.` }, { status: 400 });
      }
      if (entries.length > 16) return NextResponse.json({ error: "16 binômes maximum." }, { status: 400 });
      await admin.from("babyfoot_matches").delete().eq("tournament_id", t.id);
      await admin.from("babyfoot_entries").update({ pool_label: null, seed: null, final_rank: null }).eq("tournament_id", t.id);
      await admin.from("babyfoot_awards").delete().eq("tournament_id", t.id);

      const entryIds = entries.map((e) => e.id); // identité participant = entrée
      const gen = generateChampionship(entryIds, BABYFOOT.matchesPerTeam, t.ko_target);
      const sched = schedule(gen, { slots: BABYFOOT.slots, matchesPerSlot: BABYFOOT.matchesPerSlot, slotStartISO, availabilityByTeam: availabilityMap(entries) });
      await insertGenMatches(admin, t.id, gen, toScheduleMap(sched.assignments), entryTeamMap(entries));
      return NextResponse.json({ ok: true, leagueMatches: gen.length, warnings: sched.warnings, conflicts: sched.conflicts }, no);
    }

    case "generate_ko": {
      // Après le championnat : demies depuis le Top 4 (1v4 / 2v3), planifiées le
      // vendredi. Ne touche pas aux matchs de championnat.
      const [entries, matches] = await Promise.all([getEntries(admin, t.id), getMatches(admin, t.id)]);
      const standings = computeChampionshipStandings(
        entries.map((e) => ({ id: e.id, team_id: e.team_id, pool_label: e.pool_label, forfeited: e.forfeited })),
        matches, BABYFOOT.qualifiers
      );
      const top = standings.slice(0, BABYFOOT.qualifiers).filter((s) => !s.forfeited);
      if (top.length < BABYFOOT.qualifiers) return NextResponse.json({ error: "Championnat non terminé." }, { status: 400 });
      // Seed rangs 1..4 (identité = entry_id) → generateKnockout croise 1v4 et 2v3.
      const seeded = top.map((s) => s.entry_id);
      await admin.from("babyfoot_matches").delete().eq("tournament_id", t.id).neq("phase", "league");
      const gen = generateKnockout(seeded, { koTarget: t.ko_target, finalTarget: t.final_target, startOrder: 1000 });
      // Finales : placées sur les créneaux du vendredi (dispos ignorées).
      const sched = schedule(gen, { slots: BABYFOOT.slots, matchesPerSlot: BABYFOOT.matchesPerSlot, slotStartISO, forceDay: BABYFOOT.finalsDay });
      await insertGenMatches(admin, t.id, gen, toScheduleMap(sched.assignments), entryTeamMap(entries));
      await admin.from("babyfoot_tournaments").update({ status: "knockout" }).eq("id", t.id);
      await recomputeAwards(admin, t.id);
      return NextResponse.json({ ok: true, koMatches: gen.length }, no);
    }

    case "publish": {
      // Rend le tableau visible côté joueur/TV : statut pools (si poules) ou knockout.
      const { data: hasPool } = await admin.from("babyfoot_matches").select("id").eq("tournament_id", t.id).eq("phase", "pool").limit(1);
      const status = hasPool && hasPool.length ? "pools" : "knockout";
      await admin.from("babyfoot_tournaments").update({ status }).eq("id", t.id);
      await recomputeAwards(admin, t.id);
      return NextResponse.json({ ok: true, status }, no);
    }

    case "recompute": {
      const r = await recomputeAwards(admin, t.id);
      return NextResponse.json(r, no);
    }

    case "reset": {
      await admin.from("babyfoot_matches").delete().eq("tournament_id", t.id);
      await admin.from("babyfoot_awards").delete().eq("tournament_id", t.id);
      await admin.from("babyfoot_entries").update({ pool_label: null, seed: null, final_rank: null }).eq("tournament_id", t.id);
      await admin.from("babyfoot_tournaments").update({ status: "registration" }).eq("id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    case "delete_entry": {
      const entryId = String(body.entry_id ?? "");
      if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });
      await admin.from("babyfoot_entries").delete().eq("id", entryId).eq("tournament_id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    case "set_table": {
      const matchId = String(body.match_id ?? "");
      const tableNo = body.table_no == null ? null : Number(body.table_no);
      await admin.from("babyfoot_matches").update({ table_no: tableNo }).eq("id", matchId).eq("tournament_id", t.id);
      return NextResponse.json({ ok: true }, no);
    }

    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
}
