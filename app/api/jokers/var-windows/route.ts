import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/jokers/var-windows — liste des match_id où l'utilisateur courant a une
// fenêtre VAR active (modification de prono prolongée). Sert au MatchCard pour
// garder la saisie ÉDITABLE pendant le live au lieu de « verrouillé ».
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ matchIds: [] });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id").eq("auth_id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ matchIds: [] });

  const { data } = await admin
    .from("joker_effects")
    .select("match_id")
    .eq("affected_user_id", profile.id)
    .eq("effect_type", "var_window")
    .eq("status", "active");

  const matchIds = [...new Set((data ?? []).map((r: { match_id: string | null }) => r.match_id).filter(Boolean))];
  return NextResponse.json(
    { matchIds },
    { headers: { "Cache-Control": "no-store" } }
  );
}
