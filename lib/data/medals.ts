// Médailles absurdes Canal Cup — calculées dynamiquement depuis les pronostics
// Uniquement sur les matchs settlés

import { createAdminClient } from "@/lib/supabase/admin";

export interface Medal {
  key: string;
  emoji: string;
  label: string;
  description: string;
  team_id: string;
  team_name: string;
  value: string;
}

interface PredRow {
  team_id: string;
  team_name: string;
  predicted_score_a: number;
  predicted_score_b: number;
  points_awarded: number;
  actual_a: number | null;
  actual_b: number | null;
}

interface TeamStats {
  team_id: string;
  team_name: string;
  total: number;
  draws: number;            // prédictions de nul
  exact: number;            // scores exacts
  zero_points: number;      // 0pt
  correct_result: number;   // vainqueur ok mais pas exact
  total_predicted_goals: number;
  score_distance: number;   // somme |pa-ra| + |pb-rb|
}

export async function computeMedals(): Promise<Medal[]> {
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("predictions")
    .select(`
      team_id,
      predicted_score_a,
      predicted_score_b,
      points_awarded,
      match:matches!inner(score_a, score_b, is_settled),
      team:teams(name)
    `)
    .eq("match.is_settled", true);

  if (!rows?.length) return [];

  // Normalize rows — exclure les utilisateurs sans équipe (team_id null)
  // pour éviter le groupe "Inconnu" qui aggrège tous les non-affectés.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const preds: PredRow[] = (rows as any[])
    .filter((r) => r.team_id && r.team?.name)
    .map((r) => ({
      team_id: r.team_id,
      team_name: r.team.name as string,
      predicted_score_a: r.predicted_score_a ?? 0,
      predicted_score_b: r.predicted_score_b ?? 0,
      points_awarded: r.points_awarded ?? 0,
      actual_a: r.match?.score_a ?? null,
      actual_b: r.match?.score_b ?? null,
    })).filter((r) => r.actual_a !== null);

  // Aggregate by team
  const teams = new Map<string, TeamStats>();

  for (const p of preds) {
    if (!teams.has(p.team_id)) {
      teams.set(p.team_id, {
        team_id: p.team_id,
        team_name: p.team_name,
        total: 0,
        draws: 0,
        exact: 0,
        zero_points: 0,
        correct_result: 0,
        total_predicted_goals: 0,
        score_distance: 0,
      });
    }
    const t = teams.get(p.team_id)!;
    t.total++;
    if (p.predicted_score_a === p.predicted_score_b) t.draws++;
    if (p.predicted_score_a === p.actual_a && p.predicted_score_b === p.actual_b) t.exact++;
    if (p.points_awarded === 0) t.zero_points++;
    if (
      p.points_awarded > 0 &&
      !(p.predicted_score_a === p.actual_a && p.predicted_score_b === p.actual_b)
    ) t.correct_result++;
    t.total_predicted_goals += (p.predicted_score_a + p.predicted_score_b);
    if (p.actual_a !== null && p.actual_b !== null) {
      t.score_distance += Math.abs(p.predicted_score_a - p.actual_a) + Math.abs(p.predicted_score_b - p.actual_b);
    }
  }

  // Only teams with >= 3 settled predictions
  const eligible = [...teams.values()].filter((t) => t.total >= 3);
  if (!eligible.length) return [];

  const medals: Medal[] = [];

  // 🤝 Roi du Nul — plus de pronostics de nul
  const roiNul = eligible.sort((a, b) => b.draws - a.draws)[0];
  if (roiNul.draws >= 1) {
    medals.push({
      key: "roi_du_nul",
      emoji: "🤝",
      label: "Roi du Nul",
      description: `${roiNul.draws} prono${roiNul.draws > 1 ? "s" : ""} de match nul. La vie en 0-0.`,
      team_id: roiNul.team_id,
      team_name: roiNul.team_name,
      value: `${roiNul.draws}x nul`,
    });
  }

  // 🔮 Oracle Incompris — plus de scores exacts
  const oracle = [...eligible].sort((a, b) => b.exact - a.exact)[0];
  if (oracle.exact >= 1) {
    medals.push({
      key: "oracle_incompris",
      emoji: "🔮",
      label: "Oracle Incompris",
      description: `${oracle.exact} score${oracle.exact > 1 ? "s" : ""} exact${oracle.exact > 1 ? "s" : ""}. Ils savent. Ils ne sont juste pas toujours crus.`,
      team_id: oracle.team_id,
      team_name: oracle.team_name,
      value: `${oracle.exact} exact${oracle.exact > 1 ? "s" : ""}`,
    });
  }

  // 💀 Roi de la Déveine — plus de 0 points (en %)
  const deveine = [...eligible].sort((a, b) => (b.zero_points / b.total) - (a.zero_points / a.total))[0];
  if (deveine.zero_points >= 1) {
    const pct = Math.round((deveine.zero_points / deveine.total) * 100);
    medals.push({
      key: "roi_deveine",
      emoji: "💀",
      label: "Roi de la Déveine",
      description: `${pct}% de pronostics à 0 point. Même Le Goat est désolé.`,
      team_id: deveine.team_id,
      team_name: deveine.team_name,
      value: `${pct}% à 0pt`,
    });
  }

  // 😅 Presque Champion — plus de "vainqueur correct mais score raté"
  const presque = [...eligible].sort((a, b) => b.correct_result - a.correct_result)[0];
  if (presque.correct_result >= 1) {
    medals.push({
      key: "presque_champion",
      emoji: "😅",
      label: "Presque Champion",
      description: `${presque.correct_result} fois le bon vainqueur, jamais le bon score. Si près. Si loin.`,
      team_id: presque.team_id,
      team_name: presque.team_name,
      value: `${presque.correct_result}x presque`,
    });
  }

  // 🚀 Grand Optimiste — plus de buts prédit en moyenne
  const optimiste = [...eligible].sort((a, b) => (b.total_predicted_goals / b.total) - (a.total_predicted_goals / a.total))[0];
  const avgGoals = (optimiste.total_predicted_goals / optimiste.total).toFixed(1);
  medals.push({
    key: "grand_optimiste",
    emoji: "🚀",
    label: "Grand Optimiste",
    description: `${avgGoals} buts prédits par match en moyenne. L'offensivité comme philosophie de vie.`,
    team_id: optimiste.team_id,
    team_name: optimiste.team_name,
    value: `moy. ${avgGoals} buts`,
  });

  // 🎯 Expert en Précision — distance score la plus faible en moyenne (meilleur pronostiqueur net)
  const precision = [...eligible].sort(
    (a, b) => (a.score_distance / a.total) - (b.score_distance / b.total)
  )[0];
  const avgDist = (precision.score_distance / precision.total).toFixed(1);
  medals.push({
    key: "expert_precision",
    emoji: "🎯",
    label: "Expert en Précision",
    description: `Distance moyenne de ${avgDist} but(s) du score réel. La méthode est là. Les étoiles aussi.`,
    team_id: precision.team_id,
    team_name: precision.team_name,
    value: `±${avgDist} buts`,
  });

  return medals;
}
