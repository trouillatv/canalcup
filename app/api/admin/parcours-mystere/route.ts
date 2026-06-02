// Admin — Parcours Mystère
// GET  : liste les mystery_players (triés par sort_order) + les équipes
// POST : attribue des points à une équipe via score_events (source_type = manual_admin)
// Protégé par x-admin-secret.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("mystery_players").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("teams").select("id, name").order("name"),
  ]);
  return NextResponse.json({ players: players ?? [], teams: teams ?? [] });
}

export async function POST(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { team_id, raw_points, label } = body as {
    team_id: string;
    raw_points: number;
    label: string;
  };

  if (!team_id || !raw_points || !label) {
    return NextResponse.json({ error: "team_id, raw_points et label requis" }, { status: 400 });
  }
  if (raw_points < 0 || raw_points > 100) {
    return NextResponse.json({ error: "Points invalides" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.from("score_events").insert({
    team_id,
    user_id: null,
    category: "challenges",
    source_type: "manual_admin",
    source_id: null,
    raw_points,
    label,
    description: "Parcours Mystère",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
