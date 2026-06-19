// Espion 🕵️ — consultation des pronostics futurs des autres joueurs.
//  GET  : statut de l'effet (actif, matchs restants, matchs déjà consultés).
//  POST : { match_id } → consomme une consultation (max 5) et renvoie les
//         pronos des autres pour ce match.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasActiveEffect, recordSpyView } from "@/lib/jokers/service";
import { getAdminEmails } from "@/lib/data/roles";
import { SPY_MAX_MATCHES } from "@/lib/jokers/catalog";

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  return me?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const effect = await hasActiveEffect(userId, "spy");
  if (!effect) return NextResponse.json({ active: false });

  const viewed = ((effect.metadata as { viewed_match_ids?: string[] })?.viewed_match_ids ?? []) as string[];
  const admin = createAdminClient();
  const { data: matches } = await admin
    .from("matches")
    .select("id, team_a, team_b, flag_a, flag_b, starts_at, status, phase")
    .eq("status", "upcoming")
    .order("starts_at", { ascending: true })
    .limit(60);

  return NextResponse.json(
    {
      active: true,
      endsAt: effect.ends_at,
      remaining: Math.max(0, SPY_MAX_MATCHES - viewed.length),
      viewedMatchIds: viewed,
      matches: matches ?? [],
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const matchId = typeof body?.match_id === "string" ? body.match_id : null;
  if (!matchId) return NextResponse.json({ error: "match_id requis" }, { status: 400 });

  const view = await recordSpyView(userId, matchId);
  if (!view.ok) return NextResponse.json({ error: view.error }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: preds }, adminEmails] = await Promise.all([
    admin
      .from("predictions")
      .select("user_id, predicted_score_a, predicted_score_b")
      .eq("match_id", matchId),
    getAdminEmails(),
  ]);

  const rows = (preds ?? []).filter((p) => p.user_id !== userId);
  const userIds = [...new Set(rows.map((p) => p.user_id))];
  const { data: users } = userIds.length
    ? await admin.from("users").select("id, display_name, name, email").in("id", userIds)
    : { data: [] as { id: string; display_name: string | null; name: string | null; email: string | null }[] };
  const byId = new Map((users ?? []).map((u) => [u.id, u]));

  const details = rows
    .map((p) => {
      const u = byId.get(p.user_id);
      const email = (u?.email ?? "").toLowerCase();
      if (email && adminEmails.has(email)) return null;
      return {
        name: u?.display_name?.trim() || u?.name?.trim() || "Joueur",
        predicted_score_a: p.predicted_score_a,
        predicted_score_b: p.predicted_score_b,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return NextResponse.json(
    { ok: true, remaining: view.remaining, details },
    { headers: { "Cache-Control": "no-store" } }
  );
}
