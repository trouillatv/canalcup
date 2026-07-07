// Saisie / correction d'un résultat de match baby-foot.
// POST { match_id, score_a, score_b } → enregistre, fait AVANCER le vainqueur
// (et le perdant de demie vers la petite finale), puis RECALCULE les points.
// Idempotent : corriger un score relance l'avancement + recomputeAwards.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminRequest } from "@/lib/auth/admin";
import { recomputeAwards } from "@/lib/babyfoot/awards";
import { applyResult } from "@/lib/babyfoot/persist";

export async function POST(req: Request) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const admin = createAdminClient();

  let body: { match_id?: string; score_a?: unknown; score_b?: unknown; clear?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const matchId = String(body.match_id ?? "");
  if (!matchId) return NextResponse.json({ error: "match_id requis." }, { status: 400 });

  const { data: m } = await admin
    .from("babyfoot_matches").select("id, tournament_id").eq("id", matchId).maybeSingle();
  if (!m) return NextResponse.json({ error: "Match introuvable." }, { status: 404 });

  // Annulation d'un résultat (remet en 'upcoming').
  if (body.clear) {
    await admin.from("babyfoot_matches").update({ score_a: null, score_b: null, status: "upcoming" }).eq("id", matchId);
    if (m.tournament_id) await recomputeAwards(admin, m.tournament_id);
    return NextResponse.json({ ok: true, cleared: true });
  }

  const a = Number(body.score_a);
  const b = Number(body.score_b);
  if (a === b) return NextResponse.json({ error: "Pas de match nul en baby-foot — il faut un vainqueur." }, { status: 400 });
  const ok = await applyResult(admin, matchId, a, b);
  if (!ok) return NextResponse.json({ error: "Scores invalides." }, { status: 400 });

  if (m.tournament_id) await recomputeAwards(admin, m.tournament_id);
  return NextResponse.json({ ok: true });
}
