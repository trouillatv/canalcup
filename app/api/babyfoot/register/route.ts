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
import { competitionLock } from "@/lib/event/status";
import { featureGuardResponse } from "@/lib/features/flags";
import {
  getActiveOfficialTournament, resolveUserBinome, getEntries,
  getEntryBinomeContext, getNextEntryMatch, notifyBabyfootUser,
  getBinomeAvailability, recomputeEntryAvailability,
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

  // Mon inscription : binôme officiel (via mon équipe) OU paire ad-hoc où je
  // suis p1/p2. Les dispos d'une paire sont éditables par ses 2 joueurs.
  let myEntry = binome?.teamId
    ? entries.find((e) => e.team_id === binome.teamId) ?? null
    : null;
  let myOpenPair: { partnerName: string | null; helper: boolean } | null = null;
  if (!myEntry && tournament && binome) {
    const { data: mine } = await admin
      .from("babyfoot_entries").select("id, p1_user_id, p2_user_id, p2_is_helper")
      .eq("tournament_id", tournament.id).eq("kind", "open")
      .or(`p1_user_id.eq.${binome.meId},p2_user_id.eq.${binome.meId}`)
      .limit(1).maybeSingle();
    if (mine) {
      myEntry = entries.find((e) => e.id === mine.id) ?? null;
      if (myEntry) {
        const partner = myEntry.members.find((n) => n !== binome.meName) ?? null;
        myOpenPair = { partnerName: partner, helper: !!mine.p2_is_helper };
      }
    }
  }

  // Nombre de binômes dispos par créneau (pour afficher le remplissage / "complet").
  const slotCounts: Record<string, number> = {};
  for (const e of entries) for (const k of e.availability) slotCounts[k] = (slotCounts[k] ?? 0) + 1;

  // Contexte « page binôme » : qui a créé l'inscription, qui a saisi les créneaux,
  // avec qui je joue, et où en est le binôme (état + prochain match).
  let binomeCtx: Awaited<ReturnType<typeof getEntryBinomeContext>> | null = null;
  let availability: Awaited<ReturnType<typeof getBinomeAvailability>> | null = null;
  let nextMatch: Awaited<ReturnType<typeof getNextEntryMatch>> | null = null;
  let homeState: "creating" | "registered" | "draw" | "live" = "creating";
  if (myEntry && binome && tournament) {
    binomeCtx = await getEntryBinomeContext(admin, myEntry.id, binome.meId);
    availability = await getBinomeAvailability(admin, myEntry.id, binome.meId, binomeCtx?.partnerUserId ?? null);
    const st = tournament.status;
    if (st === "pools" || st === "knockout") {
      homeState = "live";
      nextMatch = await getNextEntryMatch(admin, tournament.id, myEntry.id);
    } else if (st === "draw") {
      homeState = "draw";
    } else {
      homeState = "registered";
    }
  }

  return NextResponse.json(
    {
      tournament: tournament && {
        id: tournament.id, name: tournament.name, event_date: tournament.event_date,
        status: tournament.status, registration_open: tournament.registration_open,
        target_teams: tournament.target_teams,
      },
      slots: BABYFOOT.slots,
      minSlots: BABYFOOT.minSlots,
      recommendedSlots: BABYFOOT.recommendedSlots,
      slotCap: BABYFOOT.slotRegistrationCap,
      slotCounts,
      binome, // { meName, teamId, teamName, partnerName, memberCount }
      myEntry, // inscription existante (ou null)
      myOpenPair, // { partnerName, helper } si mon inscription est une paire ad-hoc
      binomeCtx, // créateur / auteur des créneaux / coéquipier (page binôme)
      availability, // { mySlots, partnerSlots, partnerHasSet, commonSlots } (par joueur)
      homeState, // creating | registered | draw | live
      nextMatch, // prochain match du binôme (si tournoi en cours)
      registeredCount: entries.length,
      entries: entries.map((e) => ({ id: e.id, label: e.label })), // liste publique
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const blocked = featureGuardResponse("babyfoot");
  if (blocked) return blocked;
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
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

  // Paire ad-hoc dont je suis un joueur RÉEL (p1, ou p2 non-renfort) : je peux
  // mettre à jour ses dispos/nom sans passer par la voie « équipe ». Un renfort
  // ne gère PAS la paire qu'il dépanne (ses dispos = celles de son binôme officiel).
  const { data: myOpen } = await admin
    .from("babyfoot_entries").select("id")
    .eq("tournament_id", tournament.id).eq("kind", "open")
    .or(`p1_user_id.eq.${binome.meId},and(p2_user_id.eq.${binome.meId},p2_is_helper.eq.false)`)
    .limit(1).maybeSingle();

  if (!myOpen) {
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
  }

  let body: { display_name?: string; slots?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }

  const display_name = (body.display_name ?? "").toString().trim().slice(0, 60) || null;
  const slots = Array.isArray(body.slots)
    ? [...new Set(body.slots.map(String).filter((s) => SLOT_KEYS.has(s)))]
    : [];

  // Une seule table → il faut au moins BABYFOOT.minSlots créneaux de 30 min.
  if (slots.length < BABYFOOT.minSlots) {
    return NextResponse.json({ error: `Choisis au moins ${BABYFOOT.minSlots} créneaux de 30 min.` }, { status: 400 });
  }
  // Blocage capacité : un créneau se ferme au-delà de slotRegistrationCap binômes
  // (hors soi-même). On refuse d'AJOUTER un créneau déjà complet.
  const { data: allAvail } = await admin
    .from("babyfoot_entry_availability")
    .select("slot_key, entry_id, entry:babyfoot_entries!entry_id(tournament_id, team_id)");
  const countBySlot = new Map<string, number>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (allAvail ?? []) as any[]) {
    const entry = Array.isArray(r.entry) ? r.entry[0] : r.entry;
    if (!entry || entry.tournament_id !== tournament.id) continue;
    // On exclut MA propre inscription du comptage (paire ad-hoc ou équipe).
    if (myOpen && r.entry_id === myOpen.id) continue;
    if (!myOpen && binome.teamId && entry.team_id === binome.teamId) continue;
    countBySlot.set(r.slot_key, (countBySlot.get(r.slot_key) ?? 0) + 1);
  }
  const full = slots.filter((s) => (countBySlot.get(s) ?? 0) >= BABYFOOT.slotRegistrationCap);
  if (full.length) {
    const labels = full.map((k) => BABYFOOT.slots.find((s) => s.key === k)?.label ?? k).join(", ");
    return NextResponse.json({ error: `Créneau(x) complet(s) : ${labels}. Choisis-en d'autres.` }, { status: 409 });
  }

  // Upsert de l'inscription : paire ad-hoc existante, sinon via mon équipe.
  const existing = myOpen ?? (await admin
    .from("babyfoot_entries")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("team_id", binome.teamId)
    .maybeSingle()).data;

  const nowIso = new Date().toISOString();
  let entryId: string;
  if (existing) {
    entryId = existing.id;
    await admin.from("babyfoot_entries")
      .update({ display_name, slots_updated_by: binome.meId, slots_updated_at: nowIso })
      .eq("id", entryId);
  } else {
    const { data: created, error } = await admin
      .from("babyfoot_entries")
      .insert({
        tournament_id: tournament.id, team_id: binome.teamId,
        display_name, registered_by: binome.meId,
        slots_updated_by: binome.meId, slots_updated_at: nowIso,
      })
      .select("id")
      .single();
    if (error || !created) {
      return NextResponse.json({ error: error?.message ?? "Inscription impossible." }, { status: 500 });
    }
    entryId = created.id;
  }

  // Disponibilités PAR JOUEUR : on remplace UNIQUEMENT les miennes (jamais celles
  // du coéquipier → fini le « dernier qui édite gagne »). On repère si MES
  // créneaux ont changé pour décider d'une notification.
  const { data: prevRows } = await admin
    .from("babyfoot_player_availability").select("slot_key")
    .eq("entry_id", entryId).eq("user_id", binome.meId);
  const prevSet = new Set((prevRows ?? []).map((r: { slot_key: string }) => r.slot_key));
  const mineChanged = prevSet.size !== slots.length || slots.some((s) => !prevSet.has(s));

  await admin.from("babyfoot_player_availability").delete().eq("entry_id", entryId).eq("user_id", binome.meId);
  if (slots.length) {
    await admin.from("babyfoot_player_availability")
      .insert(slots.map((slot_key) => ({ entry_id: entryId, user_id: binome.meId, slot_key })));
  }

  // L'effectif du binôme (lu par le moteur) = INTERSECTION des joueurs qui ont
  // saisi. Recalcul déterministe après chaque édition individuelle.
  const effective = await recomputeEntryAvailability(admin, entryId);

  // Notifier le coéquipier quand JE modifie MES dispos : il voit combien de
  // créneaux communs il reste (et s'il en manque). Deux notions distinctes,
  // mais le binôme reste informé — sans que personne n'écrase l'autre.
  const ctx = await getEntryBinomeContext(admin, entryId, binome.meId);
  if (existing && mineChanged && ctx?.partnerUserId && !ctx.iAmHelperPartner) {
    const common = effective.length;
    const missing = Math.max(0, BABYFOOT.minSlots - common);
    const msg = common === 0
      ? `${binome.meName} a renseigné ses disponibilités, mais vous n'avez aucun créneau commun pour l'instant.`
      : missing > 0
        ? `${binome.meName} a mis à jour ses disponibilités : ${common} créneau${common > 1 ? "x" : ""} commun${common > 1 ? "s" : ""} — il en manque ${missing}.`
        : `${binome.meName} a mis à jour ses disponibilités : ${common} créneau${common > 1 ? "x" : ""} commun${common > 1 ? "s" : ""}.`;
    await notifyBabyfootUser(admin, ctx.partnerUserId, {
      title: "🏓 Disponibilités du binôme",
      message: msg,
      url: "/babyfoot/register",
    });
  }

  return NextResponse.json({ ok: true, entryId, updated: !!existing, common: effective.length });
}
