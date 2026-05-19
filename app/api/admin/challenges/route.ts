// Admin challenges — voir activités/participations, créer une participation
// manuelle, approuver/masquer, attribuer des points.
//
// Source de vérité du scoring : score_events. Une participation `approved`
// avec points > 0 ⇒ exactement UNE ligne score_events (source_id = entry.id).
// Re-synchronisée à chaque PATCH ⇒ idempotent, jamais de double comptage,
// masquer/0pt retire la ligne. Aucune écriture dans teams.total_points.
//
// Protégé par header x-admin-secret (même convention que /api/admin/babyfoot).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PARTICIPATION_MIN_POINTS } from "@/lib/scoring/config";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

const ENTRY_SELECT =
  "*, team:teams(id, name, slogan, color), challenge:challenges(id, slug, title, category, max_points)";

// Recalcule la ligne score_events d'une participation depuis son état courant.
async function syncScoreEvent(
  supabase: ReturnType<typeof createAdminClient>,
  entryId: string
) {
  const { data: entry } = await supabase
    .from("challenge_entries")
    .select("id, team_id, user_id, title, points_awarded, status, challenge:challenges(title, category, max_points)")
    .eq("id", entryId)
    .single();

  // Toujours repartir d'une table propre pour cette source.
  await supabase
    .from("score_events")
    .delete()
    .eq("source_type", "challenge_entry")
    .eq("source_id", entryId);

  if (!entry) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ch = (entry as any).challenge;
  // Non approuvée = 0 (levier admin pour ne rien donner : pending/hidden).
  if (entry.status !== "approved") return;

  // Approuvée → au moins le plancher de participation, plafonné par le
  // max_points du défi (un petit défi ne dépasse pas son cap).
  const maxPts = Number(ch?.max_points ?? 0);
  const floor =
    maxPts > 0
      ? Math.min(PARTICIPATION_MIN_POINTS, maxPts)
      : PARTICIPATION_MIN_POINTS;
  const total = Math.max(entry.points_awarded ?? 0, floor);
  if (total <= 0) return; // sécurité si plancher désactivé (=0) et 0 attribué

  const category = ch?.category === "social" ? "social" : "challenges";
  const label = ch?.title ?? "Animation";
  const description = entry.title ?? null;

  // Participants (phase 2.A) : si la table en a, on distribue à parts
  // entières égales ; chacun crédite SON équipe Canal Cup.
  const { data: parts } = await supabase
    .from("challenge_entry_participants")
    .select("user_id, user:users(team_id)")
    .eq("entry_id", entry.id);
  const participants = (parts ?? []) as Array<{
    user_id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any;
  }>;

  if (participants.length === 0) {
    // Aucune participation enregistrée (entry "team-level" historique) →
    // 1 ligne au team_id de l'entry, comportement préservé.
    await supabase.from("score_events").insert({
      team_id: entry.team_id,
      user_id: entry.user_id ?? null,
      category,
      source_type: "challenge_entry",
      source_id: entry.id,
      raw_points: total,
      label,
      description,
    });
    return;
  }

  // N participants → division entière égale. N inclut TOUS les membres
  // (même sans team_id) pour préserver l'équité de groupe ; les membres
  // sans équipe perdent leur part (pas d'équipe à créditer).
  const N = participants.length;
  const share = Math.floor(total / N);
  if (share <= 0) return; // total < N → personne ne récupère de part entière

  const rows = participants
    .filter((p) => p.user?.team_id)
    .map((p) => ({
      team_id: p.user.team_id as string,
      user_id: p.user_id,
      category,
      source_type: "challenge_entry",
      source_id: entry.id,
      raw_points: share,
      label,
      description,
    }));

  if (rows.length > 0) {
    await supabase.from("score_events").insert(rows);
  }
}

// GET — challenges + participations (triées par sort_order puis date).
export async function GET(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();

  const [{ data: challenges, error: cErr }, { data: entries, error: eErr }] = await Promise.all([
    supabase.from("challenges").select("*").order("sort_order", { ascending: true }),
    supabase.from("challenge_entries").select(ENTRY_SELECT).order("created_at", { ascending: false }),
  ]);

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  return NextResponse.json({ challenges: challenges ?? [], entries: entries ?? [] });
}

// POST — créer une participation manuelle (avec participants optionnels).
export async function POST(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { challenge_id, team_id, title, content, participant_user_ids } = await req.json();

  if (!challenge_id || !team_id) {
    return NextResponse.json({ error: "challenge_id et team_id requis" }, { status: 400 });
  }

  // Liste de participants déduit/dédoublonnée (phase 2.A). Validation
  // anti-multi pour les défis solo AVANT d'insérer l'entry (zéro orphelin).
  const ids = Array.isArray(participant_user_ids)
    ? [...new Set(
        (participant_user_ids as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.length > 0
        )
      )]
    : [];
  if (ids.length > 1) {
    const { data: ch } = await supabase
      .from("challenges")
      .select("allows_group")
      .eq("id", challenge_id)
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!(ch as any)?.allows_group) {
      return NextResponse.json(
        { error: "Ce défi est en solo — un seul participant autorisé." },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("challenge_entries")
    .insert({
      challenge_id,
      team_id,
      title: title ?? null,
      content: content ?? null,
      status: "pending",
      points_awarded: 0,
    })
    .select(ENTRY_SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (ids.length > 0) {
    await supabase
      .from("challenge_entry_participants")
      .insert(ids.map((user_id) => ({ entry_id: data.id, user_id })));
  }

  return NextResponse.json(data, { status: 201 });
}

// PATCH — soit une participation (approve/hide + points), soit le statut d'une
// activité. Resynchronise score_events après toute modif de participation.
export async function PATCH(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();

  // Statut d'une activité (live/finished/upcoming/hidden).
  if (body.challenge_id && body.status && !body.entry_id) {
    const { data, error } = await supabase
      .from("challenges")
      .update({ status: body.status })
      .eq("id", body.challenge_id)
      .select("*")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Participation : points, statut et/ou liste de participants.
  const { entry_id, points_awarded, status, participant_user_ids } = body;
  if (!entry_id) return NextResponse.json({ error: "entry_id requis" }, { status: 400 });

  const { data: current } = await supabase
    .from("challenge_entries")
    .select("id, challenge:challenges(max_points, allows_group)")
    .eq("id", entry_id)
    .single();
  if (!current) return NextResponse.json({ error: "Participation introuvable" }, { status: 404 });

  // Remplacement éventuel des participants (phase 2.A). Validé contre
  // allows_group avant toute écriture.
  if (Array.isArray(participant_user_ids)) {
    const ids = [...new Set(
      (participant_user_ids as unknown[]).filter(
        (x): x is string => typeof x === "string" && x.length > 0
      )
    )];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (ids.length > 1 && !(current as any).challenge?.allows_group) {
      return NextResponse.json(
        { error: "Ce défi est en solo — un seul participant autorisé." },
        { status: 400 }
      );
    }
    await supabase.from("challenge_entry_participants").delete().eq("entry_id", entry_id);
    if (ids.length > 0) {
      await supabase
        .from("challenge_entry_participants")
        .insert(ids.map((user_id) => ({ entry_id, user_id })));
    }
  }

  const updates: Record<string, unknown> = {};
  if (points_awarded !== undefined) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const max = (current as any).challenge?.max_points ?? 0;
    const clamped = Math.max(0, Math.min(Number(points_awarded) || 0, max > 0 ? max : 0));
    updates.points_awarded = clamped;
    // Attribuer des points vaut validation, sauf statut explicite contraire.
    if (status === undefined && clamped > 0) updates.status = "approved";
  }
  if (status !== undefined) updates.status = status;

  // Update conditionnel : un PATCH "participants seulement" ne touche pas
  // aux colonnes scalaires de l'entry mais déclenche quand même syncScoreEvent.
  if (Object.keys(updates).length > 0) {
    const { error: uErr } = await supabase
      .from("challenge_entries")
      .update(updates)
      .eq("id", entry_id);
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  await syncScoreEvent(supabase, entry_id);

  const { data, error } = await supabase
    .from("challenge_entries")
    .select(ENTRY_SELECT)
    .eq("id", entry_id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE — supprimer une participation (et sa ligne score_events).
export async function DELETE(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  await supabase.from("score_events").delete()
    .eq("source_type", "challenge_entry").eq("source_id", id);
  const { error } = await supabase.from("challenge_entries").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
