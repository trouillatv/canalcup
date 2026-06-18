// GET /api/binomes/requests — demandes "binôme" du user connecté (envoyées +
// reçues, pending uniquement). Sert au rafraîchissement client après une
// action sur /binomes ou /profile.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyPartnerRequests } from "@/lib/data/binome-requests";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const requests = await getMyPartnerRequests(me.id);
  return NextResponse.json(requests);
}
