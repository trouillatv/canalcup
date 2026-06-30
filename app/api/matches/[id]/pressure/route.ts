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
  const nowMinute = typeof match?.minute === "number" ? match.minute : null;

  // Une barre signée par intervalle. + = home (vert, vers le haut) ; − = away.
  // On garde la MINUTE DE JEU pour placer chaque barre à sa vraie position sur
  // l'axe (pas un étalement uniforme).
  const raw = rows.slice(1).map((cur, i) => {
    const prev = rows[i];
    const home = activity(cur.stats.home, prev.stats.home) + W.poss * (cur.stats.home.poss - 50);
    const away = activity(cur.stats.away, prev.stats.away) + W.poss * (cur.stats.away.poss - 50);
    return { value: home - away, minute: cur.minute };
  });

  // Normalisation : on cale le plus gros pic à 1. Plancher pour ne pas amplifier
  // le bruit d'un match calme.
  const peak = Math.max(1, ...raw.map((p) => Math.abs(p.value)));

  // Position de chaque barre = minute de jeu, en RÉSOLUTION 30 s. La minute du
  // fournisseur est entière → quand deux snapshots tombent dans la même minute
  // (cadence ~30 s), on les écarte d'une demi-minute. Garde monotone : robuste
  // aux minutes manquantes / nulles (anciens snapshots).
  let prevPos = -1;
  const points = raw.map((p) => {
    let pos = typeof p.minute === "number" ? p.minute : prevPos < 0 ? 0 : prevPos + 0.5;
    if (pos <= prevPos) pos = prevPos + 0.5;
    prevPos = pos;
    return { value: Math.round((p.value / peak) * 1000) / 1000, pos: Math.round(pos * 100) / 100 };
  });

  // Axe FIXE : on échantillonne tout le match en cellules de 30 s, dès le coup
  // d'envoi. 90' par défaut ; on n'étend à 120' QUE s'il y a réellement
  // prolongation. La décision se prend sur la VRAIE minute de jeu (l'elapsed du
  // fournisseur, qui plafonne à 90' dans le temps additionnel et ne dépasse 90'
  // qu'en prolongation) — surtout PAS sur les positions étalées des barres, que
  // l'écart de 30 s peut pousser au-delà de 90' pendant le temps additionnel.
  const REGULATION = 90, EXTRA_TIME = 120;
  const rawMaxMinute = Math.max(
    nowMinute ?? 0,
    ...rows.map((r) => (typeof r.minute === "number" ? r.minute : 0)),
    0
  );
  const totalMinutes =
    rawMaxMinute > REGULATION ? Math.max(EXTRA_TIME, Math.ceil(rawMaxMinute)) : REGULATION;

  // Curseur « instant courant » + frontière de la zone future (match en cours).
  const lastPos = points.length ? points[points.length - 1].pos : 0;
  const nowPos = finished ? totalMinutes : Math.min(totalMinutes, Math.max(lastPos, nowMinute ?? lastPos));

  return NextResponse.json(
    { live, finished, minute: nowMinute, points, totalMinutes, nowPos },
    { headers: { "Cache-Control": `s-maxage=${live ? 20 : 300}, stale-while-revalidate=20` } }
  );
}
