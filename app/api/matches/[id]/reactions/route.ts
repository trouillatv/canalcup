// GET  /api/matches/[id]/reactions  — counts per emoji
// POST /api/matches/[id]/reactions  — toggle reaction (add or remove)

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { competitionLock } from "@/lib/event/status";

const ALLOWED_EMOJIS = ["⚽", "🔥", "😱", "🤩", "😡", "🎉"] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: reactions } = await supabase
    .from("match_reactions")
    .select("emoji, user_id")
    .eq("match_id", id);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("id").eq("auth_id", user.id).single()
    : { data: null };

  const counts: Record<string, number> = {};
  const mine: string[] = [];

  for (const r of reactions ?? []) {
    counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
    if (profile && r.user_id === profile.id) mine.push(r.emoji);
  }

  return NextResponse.json({ counts, mine, total: (reactions ?? []).length });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("users").select("id").eq("auth_id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const { emoji } = await req.json();
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    return NextResponse.json({ error: "Emoji non autorisé" }, { status: 400 });
  }

  // Toggle: delete if exists, insert if not
  const { data: existing } = await supabase
    .from("match_reactions")
    .select("id")
    .eq("match_id", id)
    .eq("user_id", profile.id)
    .eq("emoji", emoji)
    .single();

  if (existing) {
    await supabase.from("match_reactions").delete().eq("id", existing.id);
    return NextResponse.json({ action: "removed", emoji });
  } else {
    await supabase.from("match_reactions").insert({
      match_id: id, user_id: profile.id, emoji,
    });
    return NextResponse.json({ action: "added", emoji });
  }
}
