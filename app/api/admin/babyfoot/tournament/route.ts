// Pilotage admin du Tournoi Baby-foot (état + machine à états).
//  GET  → état complet pour /admin/babyfoot (édition, binômes+dispos, matchs,
//         awards, projection des deux formats).
//  POST → action ∈ { config, status, registration, generate, generate_ko,
//         publish, recompute, reset, delete_entry, set_table }.
// Auth : isAdminRequest (session cookie ; pas de secret côté client).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { BABYFOOT } from "@/lib/config/babyfoot";
import {
  getActiveOfficialTournament, getEntries, getMatches, getAwards,
} from "@/lib/data/babyfoot";
import { projectBoth, planPools, structureFor } from "@/lib/babyfoot/format";
import { generatePools, generateKnockout } from "@/lib/babyfoot/generate";
import { insertGenMatches } from "@/lib/babyfoot/persist";
import { computePoolStandings, qualifiedEntryIds } from "@/lib/babyfoot/standings";
import { recomputeAwards } from "@/lib/babyfoot/awards";

const no = { headers: { "Cache-Control": "no-store" } };

export async function GET(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  if (!t) return NextResponse.json({ error: "Aucune édition active." }, { status: 404 });
  const [entries, matches, awards] = await Promise.all([
    getEntries(admin, t.id), getMatches(admin, t.id), getAwards(admin, t.id),
  ]);
  const projection = projectBoth(entries.length, BABYFOOT.avgMatchMinutes);
  return NextResponse.json({ tournament: t, entries, matches, awards, projection }, no);
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
      // Génère le tableau selon le format choisi. Repart de zéro (efface les
      // matchs existants). NE PUBLIE PAS (l'admin publie ensuite).
      const entries = await getEntries(admin, t.id);
      if (entries.length < 2) return NextResponse.json({ error: "Au moins 2 binômes requis." }, { status: 400 });
      if (entries.length > 16) return NextResponse.json({ error: "16 binômes maximum (V1)." }, { status: 400 });
      await admin.from("babyfoot_matches").delete().eq("tournament_id", t.id);
      await admin.from("babyfoot_entries").update({ pool_label: null, seed: null, final_rank: null }).eq("tournament_id", t.id);
      await admin.from("babyfoot_awards").delete().eq("tournament_id", t.id);

      const teamIds = entries.map((e) => e.team_id);
      if (t.format === "pools_ko" && structureFor(entries.length, "pools_ko").pools.length >= 2) {
        const sizes = planPools(entries.length);
        const { assignments, matches } = generatePools(teamIds, sizes, t.pool_target);
        await insertGenMatches(admin, t.id, matches);
        // pool_label sur les entries.
        const byTeam = new Map(entries.map((e) => [e.team_id, e.id]));
        for (const a of assignments) {
          const eid = byTeam.get(a.teamId);
          if (eid) await admin.from("babyfoot_entries").update({ pool_label: a.pool_label }).eq("id", eid);
        }
        return NextResponse.json({ ok: true, mode: "pools", poolMatches: matches.length }, no);
      }
      // Élimination directe : bracket depuis toutes les équipes (ordre d'inscription).
      const gen = generateKnockout(teamIds, { koTarget: t.ko_target, finalTarget: t.final_target });
      await insertGenMatches(admin, t.id, gen);
      return NextResponse.json({ ok: true, mode: "ko", koMatches: gen.length }, no);
    }

    case "generate_ko": {
      // Après les poules : construit le tableau final depuis les qualifiés
      // (top 2 de chaque poule), sans toucher aux matchs de poule.
      const [entries, matches] = await Promise.all([getEntries(admin, t.id), getMatches(admin, t.id)]);
      const standings = computePoolStandings(
        entries.map((e) => ({ id: e.id, team_id: e.team_id, pool_label: e.pool_label })),
        matches
      );
      const qualified = qualifiedEntryIds(standings, 2);
      // Seed : vainqueurs de poule d'abord (rang 1), puis 2es — croisement.
      const winners: string[] = [];
      const runners: string[] = [];
      for (const [, list] of standings) {
        if (list[0] && qualified.has(list[0].entry_id)) winners.push(list[0].team_id);
        if (list[1] && qualified.has(list[1].entry_id)) runners.push(list[1].team_id);
      }
      const seeded = [...winners, ...runners.reverse()];
      if (seeded.length < 2) return NextResponse.json({ error: "Poules non terminées." }, { status: 400 });
      // Efface l'éventuel ancien tableau final (garde les poules).
      await admin.from("babyfoot_matches").delete().eq("tournament_id", t.id).neq("phase", "pool");
      const gen = generateKnockout(seeded, { koTarget: t.ko_target, finalTarget: t.final_target, startOrder: 1000 });
      await insertGenMatches(admin, t.id, gen);
      await admin.from("babyfoot_tournaments").update({ status: "knockout" }).eq("id", t.id);
      await recomputeAwards(admin, t.id);
      return NextResponse.json({ ok: true, koMatches: gen.length, qualified: seeded.length }, no);
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
