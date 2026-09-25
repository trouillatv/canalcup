// Journée amicale baby-foot — hors points, hors classement. Un binôme signale
// qu'il veut jouer un match d'entraînement. GET (liste + moi) / POST (toggle).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveUserBinome } from "@/lib/data/babyfoot";
import { competitionLock } from "@/lib/event/status";
import { featureGuardResponse } from "@/lib/features/flags";

export async function GET() {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("babyfoot_friendly_signups")
    .select("id, team_id, note, created_at, team:teams!team_id(name)")
    .order("created_at", { ascending: false });
  const signups = ((rows ?? []) as Array<{ id: string; team_id: string; note: string | null; team: unknown }>).map((r) => {
    const team = Array.isArray(r.team) ? r.team[0] : r.team;
    return { id: r.id, team_id: r.team_id, note: r.note, name: (team as { name?: string } | null)?.name ?? "Binôme" };
  });
  return NextResponse.json({ signups, count: signups.length }, { headers: { "Cache-Control": "no-store" } });
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
  const binome = await resolveUserBinome(admin, user.id);
  if (!binome?.teamId) return NextResponse.json({ error: "Tu dois d'abord former ton binôme." }, { status: 400 });

  let body: { note?: string; cancel?: boolean } = {};
  try { body = await req.json(); } catch { /* optionnel */ }

  if (body.cancel) {
    await admin.from("babyfoot_friendly_signups").delete().eq("team_id", binome.teamId);
    return NextResponse.json({ ok: true, signed: false });
  }
  const note = (body.note ?? "").toString().slice(0, 120) || null;
  // Upsert (unique team_id).
  const { data: existing } = await admin.from("babyfoot_friendly_signups").select("id").eq("team_id", binome.teamId).maybeSingle();
  if (existing) await admin.from("babyfoot_friendly_signups").update({ note }).eq("id", existing.id);
  else await admin.from("babyfoot_friendly_signups").insert({ team_id: binome.teamId, user_id: binome.meId, note });
  return NextResponse.json({ ok: true, signed: true });
}
