// GET /api/matches/[id]/pressure
// Courbe de pression par équipe (momentum), DÉRIVÉE des snapshots de stats
// cumulées (table match_pressure, alimentée toutes les ~30 s par le cron live).
// Pour chaque intervalle entre deux snapshots, on calcule l'activité (Δ tirs
// cadrés, Δ tirs surface, Δ tirs totaux, Δ corners, Δ xG) pondérée par
// dangerosité, plus un léger biais possession. net = home − away → une barre
// signée par tranche de 30 s (positif = équipe A pousse / vert ; négatif =
// équipe B / bleu). Normalisé dans [-1, 1] côté serveur.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Pondérations du « mix » pression + occasion + tir au but. xG en gros (petits
// flottants ~0.1/occasion) ; tir cadré = l'événement le plus dangereux.
const W = {
  xg: 9,        // qualité d'occasion
  sog: 4,       // tir cadré (tir au but)
  inbox: 2.5,   // occasion (tir dans la surface)
  shots: 1.2,   // pression (tir tenté)
  corners: 1,   // pression
  poss: 0.04,   // biais possession (par point au-dessus de 50 %)
};

type Side = { sog: number; shots: number; inbox: number; corners: number; xg: number; poss: number };
type Snap = { t: number; minute: number | null; stats: { home: Side; away: Side } };

// Activité d'un camp sur l'intervalle = somme pondérée des deltas (cumulatifs →
// jamais négatifs ; on borne à 0 pour absorber une correction du fournisseur).
function activity(cur: Side, prev: Side): number {
  const d = (a: number, b: number) => Math.max(0, a - b);
  return (
    W.xg * d(cur.xg, prev.xg) +
    W.sog * d(cur.sog, prev.sog) +
    W.inbox * d(cur.inbox, prev.inbox) +
    W.shots * d(cur.shots, prev.shots) +
    W.corners * d(cur.corners, prev.corners)
  );
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [{ data: match }, { data: snaps }] = await Promise.all([
    supabase.from("matches").select("status, minute").eq("id", id).single(),
    supabase
      .from("match_pressure")
      .select("t, minute, stats")
      .eq("match_id", id)
      .order("t", { ascending: true }),
  ]);

  const rows = (snaps ?? []) as Snap[];
  const live = match?.status === "live" || match?.status === "halftime";
  const finished = match?.status === "finished";

  const base = { live, finished, minute: match?.minute ?? null };
  if (rows.length < 2) {
    return NextResponse.json(
      { ...base, points: [], expectedTotal: 0, htIndex: null },
      { headers: { "Cache-Control": "s-maxage=20, stale-while-revalidate=20" } }
    );
  }

  // Une barre signée par intervalle. + = home (vert, vers le haut) ; − = away.
  const raw = rows.slice(1).map((cur, i) => {
    const prev = rows[i];
    const home = activity(cur.stats.home, prev.stats.home) + W.poss * (cur.stats.home.poss - 50);
    const away = activity(cur.stats.away, prev.stats.away) + W.poss * (cur.stats.away.poss - 50);
    return { value: home - away, minute: cur.minute };
  });

  // Normalisation : on cale le plus gros pic à 1. Plancher pour ne pas amplifier
  // le bruit d'un match calme.
  const peak = Math.max(1, ...raw.map((p) => Math.abs(p.value)));
  const points = raw.map((p) => ({ value: Math.round((p.value / peak) * 1000) / 1000 }));

  // Mi-temps : 1ʳᵉ tranche où la minute de jeu atteint 45'.
  const htIndex = raw.findIndex((p) => (p.minute ?? 0) >= 45);

  // Zone « future » (match en cours) : on extrapole le nombre total de tranches
  // pour un match de 90' à la CADENCE OBSERVÉE (robuste à 30 s comme à 5 min).
  const lastMin = raw[raw.length - 1].minute ?? 0;
  const rate = lastMin > 0 ? lastMin / points.length : 1; // minutes de jeu / tranche
  const expectedTotal = finished ? points.length : Math.max(points.length, Math.round(90 / rate));

  return NextResponse.json(
    { ...base, points, expectedTotal, htIndex: htIndex < 0 ? null : htIndex },
    { headers: { "Cache-Control": `s-maxage=${live ? 20 : 300}, stale-while-revalidate=20` } }
  );
}
