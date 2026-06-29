import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminEmails } from "@/lib/data/roles";
import { selectAll } from "@/lib/data/select-all";
import type { Match, PredictionTrend } from "@/lib/supabase/types";
import { groupLetterForTeam } from "@/lib/football/groups-2026";
import { toFrench } from "@/lib/football/team-names";

export async function getMatches(): Promise<Match[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error || !data?.length) return [];
    // Normalise un éventuel libellé fournisseur non traduit ("Czechia" →
    // "République Tchèque") une bonne fois côté lecture : tous les consommateurs
    // (accueil, liste, TV, matinale) affichent alors le bon nom + drapeau et le
    // lien vers la fiche effectif fonctionne. toFrench est idempotent.
    return (data as Match[]).map((m) => ({
      ...m,
      team_a: toFrench(m.team_a),
      team_b: toFrench(m.team_b),
    }));
  } catch {
    return [];
  }
}

// Classements de groupes calculés DEPUIS les matchs (tous les groupes A→L),
// pas depuis la table standings (qui n'a que le groupe A). Auto-mis à jour
// quand les matchs se terminent ; avant le tournoi tout est à 0, mais les 12
// groupes apparaissent avec leurs équipes.
export interface GroupStandingRow {
  team_name_fr: string;
  team_flag: string;
  rank: number;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_diff: number;
  points: number;
  group_name: string;
}

export async function getGroupStandings(): Promise<GroupStandingRow[]> {
  try {
    const supabase = await createClient();
    const { data: matches } = await supabase
      .from("matches")
      .select("team_a, team_b, flag_a, flag_b, stage, status, score_a, score_b")
      .eq("phase", "Groupe");
    if (!matches?.length) return [];

    type Row = { team_a: string; team_b: string; flag_a: string | null; flag_b: string | null; stage: string | null; status: string; score_a: number | null; score_b: number | null };
    // ⚠️ matches.stage = la JOURNÉE ("Group Stage - 1/2/3"), pas la lettre de
    // poule. On reconstruit les vraies poules (A–L) depuis les confrontations :
    // en round-robin à 4, chaque équipe affronte exactement ses 3 adversaires →
    // { équipe } ∪ { adversaires } = la poule (indépendant des noms FR/EN).
    const real = (matches as Row[]).filter((m) => typeof m.stage === "string" && m.stage.startsWith("Group Stage"));
    if (!real.length) return [];

    const opponents = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!opponents.has(a)) opponents.set(a, new Set());
      opponents.get(a)!.add(b);
    };
    for (const m of real) { add(m.team_a, m.team_b); add(m.team_b, m.team_a); }
    // Clé canonique de poule : équipe + ses adversaires, triées.
    const groupKeyOf = (team: string) => [team, ...[...(opponents.get(team) ?? [])]].sort().join("|");

    type T = { name: string; flag: string; played: number; won: number; draw: number; lost: number; gf: number; ga: number };
    const groups = new Map<string, Map<string, T>>();
    const ensure = (team: string, name: string, flag: string | null): T => {
      const key = groupKeyOf(team);
      if (!groups.has(key)) groups.set(key, new Map());
      const g = groups.get(key)!;
      if (!g.has(name)) g.set(name, { name, flag: flag ?? "", played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0 });
      return g.get(name)!;
    };

    for (const m of real) {
      const a = ensure(m.team_a, m.team_a, m.flag_a);
      const b = ensure(m.team_b, m.team_b, m.flag_b);
      if (m.status === "finished" && m.score_a != null && m.score_b != null) {
        a.played++; b.played++;
        a.gf += m.score_a; a.ga += m.score_b; b.gf += m.score_b; b.ga += m.score_a;
        if (m.score_a > m.score_b) { a.won++; b.lost++; }
        else if (m.score_a < m.score_b) { b.won++; a.lost++; }
        else { a.draw++; b.draw++; }
      }
    }

    // Étiquette de poule = lettre officielle (A–L) ; on tente sur chaque équipe
    // (certains noms en base ne se résolvent pas — variantes API).
    const labelled = [...groups.values()].map((teams) => {
      let letter: string | null = null;
      for (const t of teams.keys()) { letter = groupLetterForTeam(t); if (letter) break; }
      return { letter: letter ?? "?", teams };
    });

    const rows: GroupStandingRow[] = [];
    for (const { letter, teams } of labelled.sort((x, y) => x.letter.localeCompare(y.letter))) {
      const arr = [...teams.values()]
        .map((t) => ({ ...t, points: t.won * 3 + t.draw, diff: t.gf - t.ga }))
        .sort((x, y) => y.points - x.points || y.diff - x.diff || y.gf - x.gf || x.name.localeCompare(y.name));
      arr.forEach((t, i) =>
        rows.push({
          team_name_fr: t.name, team_flag: t.flag, rank: i + 1,
          played: t.played, won: t.won, draw: t.draw, lost: t.lost,
          goals_for: t.gf, goals_against: t.ga, goal_diff: t.diff, points: t.points,
          group_name: letter,
        })
      );
    }
    return rows;
  } catch {
    return [];
  }
}

export async function getPredictionTrends(): Promise<Record<string, PredictionTrend>> {
  try {
    const supabase = await createClient();
    // ⚠️ Lecture AGRÉGÉE sur TOUTE la table : PostgREST plafonne chaque réponse
    // à 1000 lignes. Sans pagination, dès que `predictions` dépasse 1000 lignes
    // les pronos des matchs récents (insérés en dernier) tombent dans la tranche
    // coupée → la carte affichait « 3 pronostics » au lieu de 29. On pagine.
    const data = await selectAll<{
      match_id: string;
      prediction_result: "A" | "DRAW" | "B" | null;
      user_id: string;
      predicted_score_a: number | null;
      predicted_score_b: number | null;
    }>(
      supabase,
      "predictions",
      "match_id, prediction_result, user_id, predicted_score_a, predicted_score_b"
    );
    if (!data.length) return {};

    // Mêmes règles que l'API /api/matches/[id]/predictions-trend pour que les
    // compteurs concordent : on ignore les pronos incomplets (score null) et on
    // exclut les organisateurs (admins) — ce ne sont pas des compétiteurs.
    const rows = data.filter(
      (row) => row.predicted_score_a != null && row.predicted_score_b != null
    );

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    let adminUserIds = new Set<string>();
    if (userIds.length) {
      const adminClient = createAdminClient();
      const [{ data: users }, adminEmails] = await Promise.all([
        adminClient.from("users").select("id, email").in("id", userIds),
        getAdminEmails(),
      ]);
      adminUserIds = new Set(
        (users ?? [])
          .filter((u: { email: string | null }) => u.email && adminEmails.has(u.email.toLowerCase()))
          .map((u: { id: string }) => u.id)
      );
    }

    const map: Record<string, { total: number; a: number; draw: number; b: number }> = {};
    for (const row of rows) {
      if (adminUserIds.has(row.user_id)) continue; // admin → exclu
      if (!map[row.match_id]) map[row.match_id] = { total: 0, a: 0, draw: 0, b: 0 };
      map[row.match_id].total++;
      if (row.prediction_result === "A") map[row.match_id].a++;
      else if (row.prediction_result === "DRAW") map[row.match_id].draw++;
      else map[row.match_id].b++;
    }

    const result: Record<string, PredictionTrend> = {};
    for (const [matchId, counts] of Object.entries(map)) {
      const t = counts.total || 1;
      result[matchId] = {
        match_id: matchId,
        total: counts.total,
        votes_a: counts.a,
        votes_draw: counts.draw,
        votes_b: counts.b,
        pct_a: Math.round((counts.a / t) * 100),
        pct_draw: Math.round((counts.draw / t) * 100),
        pct_b: Math.round((counts.b / t) * 100),
      };
    }
    return result;
  } catch {
    return {};
  }
}
