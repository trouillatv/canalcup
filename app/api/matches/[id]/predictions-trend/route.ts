// GET /api/matches/[id]/predictions-trend
// Tendances pronostics Canal Cup pour un match : répartition 1/N/2, nombre de
// scores exacts (si fini), ET le détail par personne (nom, prono, résultat,
// points) trié par points obtenus. Admins exclus (comme dans les classements).
// Points calculés EN DIRECT (indépendant de is_settled).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAdminEmails } from "@/lib/data/roles";
import { calculatePoints } from "@/lib/scoring";
import { isFogged } from "@/lib/jokers/gating";
import type { Match } from "@/lib/supabase/types";

// Résultat d'un prono contre un score donné — fonctionne EN LIVE (pas de gate
// "match fini" comme getPredictionOutcome). aa/ab = score actuel du match.
type PredOutcome = "exact" | "correct_result" | "correct_diff" | "wrong" | "pending";
function liveOutcome(pa: number, pb: number, aa: number | null, ab: number | null): PredOutcome {
  if (aa == null || ab == null) return "pending";
  if (pa === aa && pb === ab) return "exact";
  const res = (x: number, y: number) => (x > y ? "A" : y > x ? "B" : "DRAW");
  if (res(pa, pb) === res(aa, ab)) return "correct_result";
  if (pa - pb === aa - ab) return "correct_diff";
  return "wrong";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createAdminClient();

  // 🌫 Brouillard : le joueur sous l'effet ne voit plus les pronos/tendances
  // des autres. On renvoie une charge masquée (mais on n'expose pas l'erreur).
  try {
    const authClient = await createClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      const { data: me } = await supabase.from("users").select("id").eq("auth_id", user.id).maybeSingle();
      if (me && (await isFogged(me.id))) {
        return NextResponse.json(
          { total: 0, started: false, a: 0, draw: 0, b: 0, exact: null, finished: false, live: false, details: [], fogged: true },
          { headers: { "Cache-Control": "no-store" } }
        );
      }
    }
  } catch {
    /* pas de blocage si la résolution échoue */
  }

  const { data: match } = await supabase
    .from("matches")
    .select("status, score_a, score_b, phase, starts_at")
    .eq("id", id)
    .single();

  const { data: preds } = await supabase
    .from("predictions")
    .select("user_id, prediction_result, predicted_score_a, predicted_score_b")
    .eq("match_id", id);

  const rows = (preds ?? []).filter(
    (p) => p.predicted_score_a != null && p.predicted_score_b != null
  );

  // Noms des joueurs + filtre admins
  const userIds = [...new Set(rows.map((p) => p.user_id))];
  const [{ data: users }, adminEmails] = await Promise.all([
    userIds.length
      ? supabase.from("users").select("id, display_name, email").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null; email: string | null }[] }),
    getAdminEmails(),
  ]);
  const userById = new Map(
    (users ?? []).map((u) => [u.id, u as { id: string; display_name: string | null; email: string | null }])
  );

  const finished = match?.status === "finished";
  const live = match?.status === "live" || match?.status === "halftime";
  // On a un score à comparer dès que le match est en cours OU fini.
  const hasScore = (live || finished) && match?.score_a != null && match?.score_b != null;

  // Détail par personne (admins exclus), avec résultat + points calculés EN
  // DIRECT contre le score courant (provisoires en live, définitifs à la fin).
  const details = rows
    .map((p) => {
      const u = userById.get(p.user_id);
      const email = (u?.email ?? "").toLowerCase();
      if (email && adminEmails.has(email)) return null; // admin → exclu
      const pa = p.predicted_score_a ?? 0;
      const pb = p.predicted_score_b ?? 0;
      const outcome = hasScore ? liveOutcome(pa, pb, match!.score_a, match!.score_b) : "pending";
      const points = hasScore
        ? calculatePoints(
            { phase: match?.phase, score_a: match?.score_a, score_b: match?.score_b } as Match,
            pa,
            pb
          )
        : null;
      return {
        user_id: p.user_id,
        name: u?.display_name?.trim() || "Joueur",
        predicted_score_a: p.predicted_score_a,
        predicted_score_b: p.predicted_score_b,
        outcome,
        points,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null)
    // Tri : par points décroissants (si fini), puis par nom
    .sort((x, y) => {
      const px = x.points ?? -1;
      const py = y.points ?? -1;
      if (py !== px) return py - px;
      return x.name.localeCompare(y.name, "fr");
    });

  const total = details.length;
  const a = details.filter((p) => getResultFromScore(p.predicted_score_a, p.predicted_score_b) === "A").length;
  const draw = details.filter((p) => getResultFromScore(p.predicted_score_a, p.predicted_score_b) === "DRAW").length;
  const b = details.filter((p) => getResultFromScore(p.predicted_score_a, p.predicted_score_b) === "B").length;
  const exact = hasScore ? details.filter((p) => p.outcome === "exact").length : null;

  // RIEN n'est dévoilé tant que le match n'a pas commencé (pronos encore
  // modifiables → on pourrait copier). On débloque au coup d'envoi (par le
  // temps, pas seulement le statut, au cas où le resync tarde à passer "live").
  const started =
    live || finished || (match?.starts_at ? new Date(match.starts_at) <= new Date() : false);

  return NextResponse.json(
    {
      total,
      started,
      // Répartition + détail masqués avant le coup d'envoi.
      a: started ? a : 0,
      draw: started ? draw : 0,
      b: started ? b : 0,
      exact: started ? exact : null,
      finished,
      live,
      details: started ? details : [],
    },
    { headers: { "Cache-Control": `s-maxage=${live ? 30 : finished ? 300 : 120}, stale-while-revalidate=30` } }
  );
}

function getResultFromScore(a: number | null, b: number | null): "A" | "DRAW" | "B" | null {
  if (a == null || b == null) return null;
  if (a > b) return "A";
  if (b > a) return "B";
  return "DRAW";
}
