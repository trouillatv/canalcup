// Inscription d'un binôme au Tournoi Baby-foot.
//  GET  → contexte pour la page /babyfoot/register (édition, mon binôme, mon
//         inscription existante, liste + nombre d'inscrits).
//  POST → inscrit / met à jour l'inscription de MON binôme + ses disponibilités.
// Binôme = équipe CanalCup (teams) de l'user connecté : « un joueur dans deux
// binômes » est impossible par construction.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { BABYFOOT } from "@/lib/config/babyfoot";
import {
  getActiveOfficialTournament, resolveUserBinome, getEntries,
} from "@/lib/data/babyfoot";

const SLOT_KEYS = new Set(BABYFOOT.slots.map((s) => s.key));

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const tournament = await getActiveOfficialTournament(admin);
  const binome = await resolveUserBinome(admin, user.id);
  const entries = tournament ? await getEntries(admin, tournament.id) : [];

  const myEntry = binome?.teamId
    ? entries.find((e) => e.team_id === binome.teamId) ?? null
    : null;

  return NextResponse.json(
    {
      tournament: tournament && {
        id: tournament.id, name: tournament.name, event_date: tournament.event_date,
        status: tournament.status, registration_open: tournament.registration_open,
        target_teams: tournament.target_teams,
      },
      slots: BABYFOOT.slots,
      binome, // { meName, teamId, teamName, partnerName }
      myEntry, // inscription existante (ou null)
      registeredCount: entries.length,
      entries: entries.map((e) => ({ id: e.id, label: e.label })), // liste publique
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const tournament = await getActiveOfficialTournament(admin);
  if (!tournament) return NextResponse.json({ error: "Aucun tournoi actif." }, { status: 404 });
  if (!tournament.registration_open) {
    return NextResponse.json({ error: "Les inscriptions sont fermées." }, { status: 403 });
  }

  const binome = await resolveUserBinome(admin, user.id);
  if (!binome) return NextResponse.json({ error: "Profil introuvable." }, { status: 404 });
  if (!binome.teamId) {
    return NextResponse.json({ error: "Tu dois d'abord former ton binôme (équipe)." }, { status: 400 });
  }
  // Règle NON contournable : un binôme = EXACTEMENT 2 joueurs. Pas d'inscription solo.
  if (binome.memberCount !== 2) {
    return NextResponse.json({
      error: binome.memberCount < 2
        ? "Il te faut un coéquipier : un binôme baby-foot compte exactement 2 joueurs."
        : "Ton équipe compte plus de 2 joueurs — un binôme baby-foot en compte exactement 2.",
    }, { status: 400 });
  }

  let body: { display_name?: string; slots?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const display_name = (body.display_name ?? "").toString().trim().slice(0, 60) || null;
  const slots = Array.isArray(body.slots)
    ? [...new Set(body.slots.map(String).filter((s) => SLOT_KEYS.has(s)))]
    : [];

  // Upsert de l'inscription (unique tournament_id + team_id → anti-doublon).
  const { data: existing } = await admin
    .from("babyfoot_entries")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("team_id", binome.teamId)
    .maybeSingle();

  let entryId: string;
  if (existing) {
    entryId = existing.id;
    await admin.from("babyfoot_entries").update({ display_name }).eq("id", entryId);
  } else {
    const { data: created, error } = await admin
      .from("babyfoot_entries")
      .insert({
        tournament_id: tournament.id, team_id: binome.teamId,
        display_name, registered_by: binome.meId,
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Inscription impossible." }, { status: 500 });
    }
    entryId = created.id;
  }

  // Disponibilités : on remplace intégralement.
  await admin.from("babyfoot_entry_availability").delete().eq("entry_id", entryId);
  if (slots.length) {
    await admin
      .from("babyfoot_entry_availability")
      .insert(slots.map((slot_key) => ({ entry_id: entryId, slot_key })));
  }

  return NextResponse.json({ ok: true, entryId, updated: !!existing });
}
