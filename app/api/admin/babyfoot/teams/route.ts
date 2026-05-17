// Admin CRUD for babyfoot teams — GET list, POST create, PATCH rename, DELETE remove
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data: teams, error: tErr } = await supabase
    .from("teams")
    .select("id, name, color, logo_url, created_at")
    .order("name", { ascending: true });
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });

  const { data: matches, error: mErr } = await supabase
    .from("babyfoot_matches")
    .select("team_a_id, team_b_id");
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  const matchCount: Record<string, number> = {};
  for (const m of matches ?? []) {
    matchCount[m.team_a_id] = (matchCount[m.team_a_id] ?? 0) + 1;
    matchCount[m.team_b_id] = (matchCount[m.team_b_id] ?? 0) + 1;
  }

  const result = (teams ?? []).map((t) => ({ ...t, match_count: matchCount[t.id] ?? 0 }));
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();
  const { name, color } = body;

  if (!name?.trim()) return NextResponse.json({ error: "Le nom est requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("teams")
    .insert({
      name: name.trim(),
      color: color?.trim() || "#FFD700",
      slogan: "",
      reputation_label: "",
      total_points: 0,
    })
    .select("id, name, color, logo_url, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ...data, match_count: 0 }, { status: 201 });
}

export async function PATCH(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();
  const { id, name, color } = body;

  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const updates: Record<string, string> = {};
  if (name?.trim()) updates.name = name.trim();
  if (color?.trim()) updates.color = color.trim();

  if (!Object.keys(updates).length) return NextResponse.json({ error: "Rien à modifier" }, { status: 400 });

  const { data, error } = await supabase
    .from("teams")
    .update(updates)
    .eq("id", id)
    .select("id, name, color, logo_url, created_at")
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

  // Check for linked matches before deleting
  const { count } = await supabase
    .from("babyfoot_matches")
    .select("id", { count: "exact", head: true })
    .or(`team_a_id.eq.${id},team_b_id.eq.${id}`);

  if (count && count > 0) {
    return NextResponse.json(
      { error: `Cette équipe est liée à ${count} match(s) de babyfoot — supprime les matchs d'abord.` },
      { status: 409 }
    );
  }

  const { error } = await supabase.from("teams").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
