// POST /api/supporters/vote — vote individuel pour une photo. Body : { entry_id }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { votesClosed } from "@/lib/supporters/access";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, team_id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  // Fenêtre de vote ouverte ? (flag admin + avant la clôture du jeudi 25/06)
  if (votesClosed()) {
    return NextResponse.json({ error: "Les votes sont clôturés." }, { status: 400 });
  }
  const { data: settings } = await admin.from("supporter_settings").select("votes_open, results_published").eq("id", 1).maybeSingle();
  if (!settings?.votes_open || settings?.results_published) {
    return NextResponse.json({ error: "Les votes ne sont pas ouverts." }, { status: 400 });
  }

  // La photo ciblée existe et est validée ?
  const { data: entry } = await admin
    .from("supporter_photo_entries")
    .select("id, team_id, status")
    .eq("id", entryId)
    .maybeSingle();
  if (!entry || entry.status !== "approved") {
    return NextResponse.json({ error: "Photo introuvable ou non validée." }, { status: 400 });
  }

  // Pas pour son propre binôme.
  if (me.team_id && entry.team_id === me.team_id) {
    return NextResponse.json({ error: "Impossible de voter pour ton propre binôme." }, { status: 400 });
  }

  // Déjà voté ? (1 vote par utilisateur, contrainte unique en base aussi.)
  const { data: existing } = await admin
    .from("supporter_photo_votes")
    .select("id")
    .eq("voter_user_id", me.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "Tu as déjà voté." }, { status: 400 });

  const { error } = await admin.from("supporter_photo_votes").insert({
    entry_id: entryId,
    voter_user_id: me.id,
    voter_team_id: me.team_id ?? null,
  });
  if (error) {
    // Course / contrainte unique : message propre.
    return NextResponse.json({ error: "Tu as déjà voté." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
