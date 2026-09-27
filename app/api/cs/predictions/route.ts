// GET  /api/cs/predictions  → pronostics de l'utilisateur courant, joints
//      aux events/participants pour éviter le N+1 côté page.
// POST /api/cs/predictions  → upsert (user_id, event_id, market_type_id) —
//      un seul verbe pour créer/modifier, cohérent avec Architecture B (une
//      seule prediction exact_score par (user, event), voir ADR 0005).
//
// Écrit via le client serveur AUTHENTIFIÉ (pas admin) : c'est la RLS
// "Creation/Modification predictions propres" (Lot 3B) + le trigger
// enforce_prediction_lock() (verrou avant coup d'envoi, même rôle
// service_role) qui font l'application réelle des règles — cette route ne
// fait que valider le payload et traduire les erreurs Postgres en réponses
// HTTP propres.
//
// Verrou de clôture globale (competitionLock, lib/event/status.ts) en plus
// du verrou DB par coup d'envoi ci-dessus : les deux sont complémentaires,
// pas redondants — une compétition fermée refuse l'écriture même si l'event
// n'a pas encore commencé (starts_at futur).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { competitionLock } from "@/lib/event/status";
import { getValidator, InvalidPredictionPayloadError } from "@/lib/predictions/contracts";

const EXACT_SCORE_MARKET_CODE = "exact_score";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const { data: predictions, error } = await supabase
    .from("predictions")
    .select(
      `id, event_id, payload, status, outcome_facts, points_awarded, submitted_at,
       events!inner (
         id, starts_at, status, stage, matchday, result,
         event_participants ( role, participants ( id, name, short_name ) )
       )`
    )
    .eq("user_id", me.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ predictions: predictions ?? [] });
}

export async function POST(req: Request) {
  const locked = await competitionLock();
  if (locked) return locked;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!me) {
    return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const eventId = typeof body.event_id === "string" ? body.event_id : "";
  if (!eventId) {
    return NextResponse.json({ error: "event_id requis" }, { status: 400 });
  }

  let payload: { home: number; away: number };
  try {
    payload = getValidator(EXACT_SCORE_MARKET_CODE)(body.payload) as { home: number; away: number };
  } catch (err) {
    if (err instanceof InvalidPredictionPayloadError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  const { data: market } = await supabase
    .from("market_types")
    .select("id")
    .eq("code", EXACT_SCORE_MARKET_CODE)
    .single();
  if (!market) {
    return NextResponse.json({ error: "Marché exact_score introuvable" }, { status: 500 });
  }

  const { data: prediction, error } = await supabase
    .from("predictions")
    .upsert(
      { user_id: me.id, event_id: eventId, market_type_id: market.id, payload },
      { onConflict: "user_id,event_id,market_type_id" }
    )
    .select("id, event_id, payload, status, submitted_at")
    .single();

  if (error) {
    // enforce_prediction_lock() (trigger, voir ADR 0005 section 5) lève une
    // exception Postgres explicite si l'event n'est plus 'scheduled' ou si
    // starts_at est dépassé — c'est le verrou SERVEUR, à ne jamais laisser
    // fuiter comme une erreur 500 brute.
    if (error.message.includes("prediction locked")) {
      return NextResponse.json({ error: "Pronostic verrouillé : le match a déjà commencé." }, { status: 403 });
    }
    if (error.message.includes("unknown event")) {
      return NextResponse.json({ error: "Match introuvable." }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ prediction });
}
