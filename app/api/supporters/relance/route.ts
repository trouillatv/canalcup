// Relance ciblée déclenchée par un organisateur (Marie/Vincent) depuis le Radar.
// Ferme la boucle observation -> action : push aux binômes sans photo, ou aux
// non-votants. Action DÉLIBÉRÉE (bouton) — pas un push automatique.
//  POST { target: "no_photo" | "no_vote" }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupportersOrganizer } from "@/lib/supporters/access";
import { sendPushToUser } from "@/lib/push";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole();
  if (!isSupportersOrganizer(role, user.email)) {
    return NextResponse.json({ error: "Réservé aux organisateurs." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const target = body?.target === "no_vote" ? "no_vote" : "no_photo";
  const admin = createAdminClient();

  const [{ data: users }, { data: entries }, { data: votes }] = await Promise.all([
    admin.from("users").select("id, auth_id, team_id").eq("profile_completed", true),
    admin.from("supporter_photo_entries").select("team_id").eq("status", "approved"),
    admin.from("supporter_photo_votes").select("voter_user_id"),
  ]);

  let targets: { auth_id: string | null }[] = [];
  let payload: { title: string; body: string; url: string };

  if (target === "no_photo") {
    const postedTeams = new Set((entries ?? []).map((e) => e.team_id));
    targets = (users ?? []).filter((u) => u.team_id && !postedTeams.has(u.team_id));
    payload = {
      title: "🎭 Concours Supporters : à toi de jouer !",
      body: "Ton binôme n'a pas encore publié sa photo. +10 pts pour participer 📸",
      url: "/supporters",
    };
  } else {
    const voters = new Set((votes ?? []).map((v) => v.voter_user_id));
    targets = (users ?? []).filter((u) => !voters.has(u.id));
    payload = {
      title: "🗳️ Tu n'as pas encore voté !",
      body: "Choisis ta photo Supporter préférée avant la clôture des votes ⏳",
      url: "/supporters",
    };
  }

  const authIds = [...new Set(targets.map((t) => t.auth_id).filter(Boolean) as string[])];
  let sent = 0;
  for (const authId of authIds) {
    try {
      await sendPushToUser(authId, payload);
      sent++;
    } catch { /* abonnement absent / expiré : on ignore */ }
  }

  return NextResponse.json({ ok: true, targeted: authIds.length, sent });
}
