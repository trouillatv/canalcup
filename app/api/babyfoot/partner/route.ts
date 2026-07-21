// « Je cherche un partenaire » — demandes de binôme baby-foot.
//  GET  → contexte : candidats (avec statut), demande reçue/envoyée, liste des
//         chercheurs. `?pending=1` = version légère pour le splash d'accueil.
//  POST → action ∈ { send, accept, refuse, cancel, seek, unseek }.
//
// Règles produit :
//  · L'émetteur d'une demande ne doit PAS déjà être inscrit (participant réel).
//  · Le destinataire peut être libre (→ paire normale, les 2 marquent) ou déjà
//    inscrit (→ il accepte EN RENFORT : il dépanne, ne gagne rien, son binôme
//    officiel reste intact).
//  · Demandes croisées (A→B et B→A en attente) → la paire se crée directement.
//  · Le trigger babyfoot_entry_validate reste le juge de paix en base.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOfficialTournament, getRealParticipants } from "@/lib/data/babyfoot";
import { competitionLock } from "@/lib/event/status";

const no = { headers: { "Cache-Control": "no-store" } };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function me(admin: Db, authId: string): Promise<{ id: string; name: string } | null> {
  const { data } = await admin.from("users").select("id, display_name, name").eq("auth_id", authId).maybeSingle();
  return data ? { id: data.id, name: data.display_name || data.name || "—" } : null;
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  const my = await me(admin, user.id);
  if (!t || !my) return NextResponse.json({ incoming: null, tournament: null }, no);

  // Demande reçue en attente (la plus ancienne) — sert aussi au splash (?pending=1).
  const { data: inc } = await admin
    .from("babyfoot_partner_requests")
    .select("id, from_user_id, created_at")
    .eq("tournament_id", t.id).eq("to_user_id", my.id).eq("status", "pending")
    .order("created_at", { ascending: true }).limit(1).maybeSingle();
  let incoming: { id: string; fromName: string } | null = null;
  if (inc) {
    const { data: fu } = await admin.from("users").select("display_name, name").eq("id", inc.from_user_id).maybeSingle();
    incoming = { id: inc.id, fromName: fu?.display_name || fu?.name || "Un collègue" };
  }
  if (new URL(req.url).searchParams.get("pending")) {
    // Le splash a besoin de savoir si JE suis déjà inscrit : dans ce cas la
    // demande reçue est un DÉPANNAGE (renfort), pas la création d'un binôme.
    let amRegistered = false;
    if (incoming) {
      const participants = await getRealParticipants(admin, t.id);
      amRegistered = participants.has(my.id);
    }
    return NextResponse.json({ incoming, registrationOpen: t.registration_open, amRegistered }, no);
  }

  const participants = await getRealParticipants(admin, t.id);
  const { data: allUsers } = await admin.from("users").select("id, display_name, name").order("display_name");
  // Binôme RSE (équipe de 2) de chaque user → partenaire affiché dans la liste
  // (« en binôme avec Y ») même s'ils ne sont pas encore inscrits au tournoi.
  const { data: memRows } = await admin.from("team_memberships").select("team_id, user_id");
  const membersByTeam = new Map<string, string[]>();
  for (const m of (memRows ?? []) as { team_id: string; user_id: string }[]) {
    if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
    membersByTeam.get(m.team_id)!.push(m.user_id);
  }
  const userNameById = new Map(((allUsers ?? []) as { id: string; display_name: string | null; name: string | null }[]).map((u) => [u.id, u.display_name || u.name || "—"]));
  const teamPartnerOf = new Map<string, string>(); // user_id → nom du coéquipier RSE
  for (const [, ids] of membersByTeam) {
    if (ids.length !== 2) continue;
    teamPartnerOf.set(ids[0], userNameById.get(ids[1]) ?? "—");
    teamPartnerOf.set(ids[1], userNameById.get(ids[0]) ?? "—");
  }
  const { data: seekRows } = await admin.from("babyfoot_seeking").select("user_id").eq("tournament_id", t.id);
  const seekingIds = new Set((seekRows ?? []).map((r: { user_id: string }) => r.user_id));
  const { data: out } = await admin
    .from("babyfoot_partner_requests")
    .select("id, to_user_id")
    .eq("tournament_id", t.id).eq("from_user_id", my.id).eq("status", "pending")
    .limit(1).maybeSingle();

  const nameOf = (u: { display_name: string | null; name: string | null }) => u.display_name || u.name || "—";
  const candidates = ((allUsers ?? []) as { id: string; display_name: string | null; name: string | null }[])
    .filter((u) => u.id !== my.id)
    .map((u) => {
      const p = participants.get(u.id);
      return {
        id: u.id, name: nameOf(u),
        status: p ? "registered" : seekingIds.has(u.id) ? "seeking" : "free",
        with: p?.label ?? null, // inscrit au tournoi : avec qui
        teamPartner: teamPartnerOf.get(u.id) ?? null, // binôme RSE (équipe) même hors tournoi
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  let outgoing: { id: string; toName: string } | null = null;
  if (out) {
    const toC = candidates.find((c) => c.id === out.to_user_id);
    outgoing = { id: out.id, toName: toC?.name ?? "—" };
  }

  return NextResponse.json({
    tournament: { id: t.id, registration_open: t.registration_open, status: t.status },
    me: { id: my.id, name: my.name, registered: participants.has(my.id), entryLabel: participants.get(my.id)?.label ?? null },
    incoming, outgoing,
    iAmSeeking: seekingIds.has(my.id),
    seekers: candidates.filter((c) => c.status === "seeking").map((c) => ({ id: c.id, name: c.name })),
    candidates,
  }, no);
}

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const t = await getActiveOfficialTournament(admin);
  const my = await me(admin, user.id);
  if (!t || !my) return NextResponse.json({ error: "Aucun tournoi actif." }, { status: 404 });

  let body: { action?: string; to_user_id?: string; request_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const action = String(body.action ?? "");
  if (!t.registration_open && ["send", "accept", "seek"].includes(action)) {
    return NextResponse.json({ error: "Les inscriptions sont fermées." }, { status: 403 });
  }

  const participants = await getRealParticipants(admin, t.id);

  switch (action) {
    case "send": {
      const to = String(body.to_user_id ?? "");
      if (!to || to === my.id) return NextResponse.json({ error: "Destinataire invalide." }, { status: 400 });
      if (participants.has(my.id)) return NextResponse.json({ error: "Tu es déjà inscrit au tournoi." }, { status: 409 });
      // Demandes croisées : s'il m'a déjà demandé → on crée la paire directement.
      const { data: cross } = await admin
        .from("babyfoot_partner_requests").select("id")
        .eq("tournament_id", t.id).eq("from_user_id", to).eq("to_user_id", my.id).eq("status", "pending")
        .maybeSingle();
      if (cross) {
        const { data: created, error } = await admin.from("babyfoot_entries")
          .insert({ tournament_id: t.id, kind: "open", p1_user_id: to, p2_user_id: my.id, registered_by: my.id })
          .select("id").single();
        if (error) return NextResponse.json({ error: error.message }, { status: 409 });
        await admin.from("babyfoot_partner_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", cross.id);
        await admin.from("babyfoot_seeking").delete().eq("tournament_id", t.id).in("user_id", [my.id, to]);
        return NextResponse.json({ ok: true, paired: true, entryId: created.id }, no);
      }
      // Une seule demande sortante active : on annule l'ancienne.
      await admin.from("babyfoot_partner_requests")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("tournament_id", t.id).eq("from_user_id", my.id).eq("status", "pending");
      const { error } = await admin.from("babyfoot_partner_requests")
        .insert({ tournament_id: t.id, from_user_id: my.id, to_user_id: to });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, renfort: participants.has(to) }, no);
    }

    case "accept": {
      const rid = String(body.request_id ?? "");
      const { data: r } = await admin.from("babyfoot_partner_requests")
        .select("id, from_user_id, to_user_id, status").eq("id", rid).maybeSingle();
      if (!r || r.to_user_id !== my.id || r.status !== "pending") {
        return NextResponse.json({ error: "Demande introuvable ou déjà traitée." }, { status: 404 });
      }
      // Si je suis déjà inscrit → j'accepte EN RENFORT (je dépanne, 0 point pour moi).
      const helper = participants.has(my.id);
      const { data: created, error } = await admin.from("babyfoot_entries")
        .insert({ tournament_id: t.id, kind: "open", p1_user_id: r.from_user_id, p2_user_id: my.id, p2_is_helper: helper, registered_by: r.from_user_id })
        .select("id").single();
      if (error) {
        // L'émetteur s'est inscrit entre-temps → demande caduque.
        await admin.from("babyfoot_partner_requests").update({ status: "cancelled", responded_at: new Date().toISOString() }).eq("id", rid);
        return NextResponse.json({ error: "Cette demande n'est plus valable : " + error.message }, { status: 409 });
      }
      await admin.from("babyfoot_partner_requests").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", rid);
      // L'émetteur est maintenant inscrit : ses autres demandes sortantes tombent.
      await admin.from("babyfoot_partner_requests")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("tournament_id", t.id).eq("from_user_id", r.from_user_id).eq("status", "pending");
      const cleaned = helper ? [r.from_user_id] : [r.from_user_id, my.id];
      await admin.from("babyfoot_seeking").delete().eq("tournament_id", t.id).in("user_id", cleaned);
      return NextResponse.json({ ok: true, entryId: created.id, helper }, no);
    }

    case "refuse": {
      const rid = String(body.request_id ?? "");
      const { error } = await admin.from("babyfoot_partner_requests")
        .update({ status: "refused", responded_at: new Date().toISOString() })
        .eq("id", rid).eq("to_user_id", my.id).eq("status", "pending");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true }, no);
    }

    case "cancel": {
      const rid = String(body.request_id ?? "");
      await admin.from("babyfoot_partner_requests")
        .update({ status: "cancelled", responded_at: new Date().toISOString() })
        .eq("id", rid).eq("from_user_id", my.id).eq("status", "pending");
      return NextResponse.json({ ok: true }, no);
    }

    case "seek": {
      if (participants.has(my.id)) return NextResponse.json({ error: "Tu es déjà inscrit au tournoi." }, { status: 409 });
      await admin.from("babyfoot_seeking").upsert({ tournament_id: t.id, user_id: my.id });
      return NextResponse.json({ ok: true }, no);
    }

    case "unseek": {
      await admin.from("babyfoot_seeking").delete().eq("tournament_id", t.id).eq("user_id", my.id);
      return NextResponse.json({ ok: true }, no);
    }

    default:
      return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  }
}
