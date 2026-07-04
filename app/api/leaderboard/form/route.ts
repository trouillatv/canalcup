// GET /api/leaderboard/form?period=3d|7d|14d|phase|last10 — classement « Forme
// récente » des pronostics : qui est CHAUD sur la période, indépendamment du
// classement général cumulé.
//
// 100 % read-model : on ne modifie AUCUN point, on ne touche pas au général.
// Basé sur les pronostics dont le MATCH a été joué (status=finished) pendant la
// période. Matchs non terminés exclus. Comparé au rang GÉNÉRAL pronos pour l'évolution.

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { selectAll } from "@/lib/data/select-all";
import { getAdminEmails } from "@/lib/data/roles";
import { getPredictionOutcome } from "@/lib/scoring";

const DAY = 86_400_000;

type MatchRow = {
  id: string;
  starts_at: string;
  phase: string | null;
  status: string;
  score_a: number | null;
  score_b: number | null;
  score_reg_a: number | null;
  score_reg_b: number | null;
};
type PredRow = {
  user_id: string | null;
  match_id: string;
  points_awarded: number | null;
  predicted_score_a: number | null;
  predicted_score_b: number | null;
};

export async function GET(req: Request) {
  const admin = createAdminClient();
  const period = new URL(req.url).searchParams.get("period") ?? "7d";

  const [matches, preds, users, teams, adminEmails] = await Promise.all([
    selectAll<MatchRow>(admin, "matches", "id, starts_at, phase, status, score_a, score_b, score_reg_a, score_reg_b"),
    selectAll<PredRow>(admin, "predictions", "user_id, match_id, points_awarded, predicted_score_a, predicted_score_b"),
    selectAll<{ id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null }>(admin, "users", "id, display_name, name, team_id, email"),
    selectAll<{ id: string; name: string }>(admin, "teams", "id, name"),
    getAdminEmails(),
  ]);

  const finished = matches.filter((m) => m.status === "finished");
  const now = Date.now();

  // ── Sélection des matchs de la période ─────────────────────────────────────
  let selected: MatchRow[];
  let periodLabel: string;
  if (period === "phase") {
    // Phase « actuelle » = celle du match terminé le plus récent.
    const latest = [...finished].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())[0];
    const ph = latest?.phase ?? null;
    selected = finished.filter((m) => m.phase === ph);
    periodLabel = `Phase actuelle${ph ? ` — ${ph}` : ""}`;
  } else if (period === "last10" || period === "last20") {
    const n = period === "last20" ? 20 : 10;
    selected = [...finished].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime()).slice(0, n);
    periodLabel = `${n} derniers matchs`;
  } else {
    const days = period === "3d" ? 3 : period === "14d" ? 14 : 7;
    const cutoff = now - days * DAY;
    selected = finished.filter((m) => new Date(m.starts_at).getTime() >= cutoff);
    periodLabel = `${days} derniers jours`;
  }

  const matchById = new Map(finished.map((m) => [m.id, m]));
  const selectedIds = new Set(selected.map((m) => m.id));

  const teamName = new Map(teams.map((t) => [t.id, t.name]));
  type U = { id: string; display_name: string | null; name: string | null; team_id: string | null; email: string | null };
  const userById = new Map((users as U[]).map((u) => [u.id, u]));
  const isAdmin = (u: U | undefined) => !!u && adminEmails.has((u.email ?? "").toLowerCase());

  // ── Agrégat de la période + agrégat GÉNÉRAL (tous matchs finis) pour l'évolution.
  type Agg = { points: number; pronos: number; good: number; exact: number };
  const zero = (): Agg => ({ points: 0, pronos: 0, good: 0, exact: 0 });
  const period_ = new Map<string, Agg>();
  const overall = new Map<string, number>(); // points pronos all-time (rang général)

  for (const p of preds) {
    if (!p.user_id) continue;
    const m = matchById.get(p.match_id);
    if (!m) continue; // match non terminé → exclu
    if (p.predicted_score_a == null || p.predicted_score_b == null) continue;
    const u = userById.get(p.user_id);
    if (isAdmin(u)) continue; // organisateurs hors classement

    overall.set(p.user_id, (overall.get(p.user_id) ?? 0) + (p.points_awarded ?? 0));

    if (!selectedIds.has(p.match_id)) continue;
    const outcome = getPredictionOutcome(
      { predicted_score_a: p.predicted_score_a, predicted_score_b: p.predicted_score_b },
      m
    );
    const e = period_.get(p.user_id) ?? zero();
    e.points += p.points_awarded ?? 0;
    e.pronos += 1;
    if (outcome === "exact") { e.exact += 1; e.good += 1; }
    else if (outcome === "correct_result") e.good += 1;
    period_.set(p.user_id, e);
  }

  // Rang général (par points pronos all-time) pour comparer.
  const overallRank = new Map<string, number>();
  [...overall.entries()].sort((a, b) => b[1] - a[1]).forEach(([uid], i) => overallRank.set(uid, i + 1));

  type Row = {
    user_id: string; display_name: string; team_name: string | null;
    points: number; pronos: number; good: number; exact: number; avg: number;
    rank: number; trend: number; // trend = rang général - rang forme (positif = remonte)
  };
  let rows: Row[] = [...period_.entries()]
    .filter(([, e]) => e.pronos > 0)
    .map(([uid, e]) => {
      const u = userById.get(uid);
      return {
        user_id: uid,
        display_name: u?.display_name?.trim() || u?.name?.trim() || "Joueur",
        team_name: u?.team_id ? teamName.get(u.team_id) ?? null : null,
        points: e.points,
        pronos: e.pronos,
        good: e.good,
        exact: e.exact,
        avg: e.pronos ? Math.round((e.points / e.pronos) * 10) / 10 : 0,
        rank: 0,
        trend: 0,
      };
    });

  rows.sort((a, b) => b.points - a.points || b.exact - a.exact || b.avg - a.avg);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    const gen = overallRank.get(r.user_id);
    r.trend = gen != null ? gen - r.rank : 0; // >0 : mieux classé sur la forme que sur le général
  });

  // ── Mises en avant ─────────────────────────────────────────────────────────
  const bestExact = rows.filter((r) => r.exact > 0).sort((a, b) => b.exact - a.exact || b.points - a.points)[0] ?? null;
  const mostRegular = [...rows].sort((a, b) => b.pronos - a.pronos || b.points - a.points)[0] ?? null;
  const biggestClimb = [...rows].filter((r) => r.trend > 0).sort((a, b) => b.trend - a.trend)[0] ?? null;

  return NextResponse.json(
    {
      period,
      periodLabel,
      matchesCount: selected.length,
      rows,
      highlights: {
        bestExact: bestExact ? { name: bestExact.display_name, value: bestExact.exact } : null,
        mostRegular: mostRegular ? { name: mostRegular.display_name, value: mostRegular.pronos } : null,
        biggestClimb: biggestClimb ? { name: biggestClimb.display_name, value: biggestClimb.trend } : null,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
