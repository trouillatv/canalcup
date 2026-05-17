// CRUD pour les événements Canal Cup (quiz, babyfoot, reveals, chaos…)
// Protected by x-admin-secret header

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function auth(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  return secret && secret === process.env.ADMIN_SECRET;
}

// GET — liste tous les events actifs à venir
export async function GET(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("canal_cup_events")
    .select("*")
    .order("starts_at", { ascending: true });
  return NextResponse.json({ events: data ?? [] });
}

// POST — créer un event
// Body: { type, title, starts_at, ends_at?, teams?, hype_level?, robert_phrase?, location? }
export async function POST(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { type, title, starts_at, ends_at, teams, hype_level, robert_phrase, location } = body;

  if (!type || !title || !starts_at) {
    return NextResponse.json({ error: "type, title, starts_at requis" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("canal_cup_events")
    .insert({
      type,
      title,
      starts_at,
      ends_at: ends_at ?? null,
      teams: teams ?? null,
      hype_level: hype_level ?? 2,
      robert_phrase: robert_phrase ?? null,
      location: location ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event: data });
}

// DELETE — supprimer un event
// Query: ?id=UUID
export async function DELETE(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const supabase = createAdminClient();
  await supabase.from("canal_cup_events").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}

// PATCH — toggle is_active
export async function PATCH(req: Request) {
  if (!auth(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, is_active } = await req.json();
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const supabase = createAdminClient();
  await supabase.from("canal_cup_events").update({ is_active }).eq("id", id);
  return NextResponse.json({ ok: true });
}
