// Admin CRUD for babyfoot matches — POST create, PATCH update score, DELETE remove
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("babyfoot_matches")
    .select("*, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)")
    .order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();
  const { team_a_id, team_b_id, round, starts_at, highlight } = body;

  if (!team_a_id || !team_b_id || !round || !starts_at) {
    return NextResponse.json({ error: "team_a_id, team_b_id, round, starts_at requis" }, { status: 400 });
  }
  if (team_a_id === team_b_id) {
    return NextResponse.json({ error: "Une équipe ne peut pas jouer contre elle-même" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("babyfoot_matches")
    .insert({ team_a_id, team_b_id, round, starts_at, highlight: highlight ?? null, status: "upcoming" })
    .select("*, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();
  const { id, score_a, score_b, status, highlight, round } = body;

  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (score_a !== undefined) updates.score_a = score_a;
  if (score_b !== undefined) updates.score_b = score_b;
  if (status !== undefined) updates.status = status;
  if (highlight !== undefined) updates.highlight = highlight;
  if (round !== undefined) updates.round = round;

  // Auto-set status to finished when scores are provided
  if (score_a !== undefined && score_b !== undefined && !status) {
    updates.status = "finished";
  }

  const { data, error } = await supabase
    .from("babyfoot_matches")
    .update(updates)
    .eq("id", id)
    .select("*, team_a:teams!team_a_id(id, name), team_b:teams!team_b_id(id, name)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const { error } = await supabase.from("babyfoot_matches").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
