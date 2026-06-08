import { createClient } from "@/lib/supabase/server";
import { getWCTeamBySlug, type WCTeam } from "@/lib/football/wc-teams";
import { groupLetterForTeam, WC2026_GROUPS } from "@/lib/football/groups-2026";
import { getFIFARank, type Confederation } from "@/lib/football/fifa-ranks";

// Normalise un nom d'équipe pour comparaison : sans accents, minuscules, espaces seuls.
function normName(n: string): string {
  return n
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Alias DB → nom canonique (WC teams JSON utilise le français).
const NAME_ALIASES: Record<string, string> = {
  "mexique": "mexique",
  "mexico": "mexique",
  "nigéria": "nigeria",
  "nigeria": "nigeria",
  "colombia": "colombie",
  "usa": "etats unis",
  "united states": "etats unis",
  "republique tcheque": "tchecuie",
  "tcheque": "tchecuie",
};

function resolveAlias(n: string): string {
  const norm = normName(n);
  return NAME_ALIASES[norm] ?? norm;
}

function sameTeam(a: string, b: string): boolean {
  return resolveAlias(a) === resolveAlias(b);
}

// ─── Types publics ──────────────────────────────────────────────────────────

export interface WCMatchSummary {
  id: string;
  teamHome: string;
  teamAway: string;
  flagHome: string | null;
  flagAway: string | null;
  scoreHome: number | null;
  scoreAway: number | null;
  status: string;
  startsAt: string;
  channel: string;
  /** true = l'équipe consultée joue à domicile (team_a) */
  isHome: boolean;
  /** résultat du point de vue de l'équipe consultée */
  result: "W" | "D" | "L" | null;
  phase: string | null;
  stage: string | null;
}

export interface FootballGroupRow {
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
  /** Résultats chronologiques des matchs de groupe joués (W/D/L). */
  wcForm: Array<"W" | "D" | "L">;
}

export interface FootballTeamDashboard {
  wcTeam: WCTeam;
  groupLetter: string | null;
  fifaRank: number | null;
  confederation: Confederation | null;
  groupStandings: FootballGroupRow[];
  pastMatches: WCMatchSummary[];
  upcomingMatches: WCMatchSummary[];
  wcStats: {
    played: number;
    won: number;
    draw: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDiff: number;
    points: number;
  };
}

// ─── Helpers privés ─────────────────────────────────────────────────────────

const ZERO_STATS = { played: 0, won: 0, draw: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 };

function initGroupFromStatic(groupLetter: string | null): FootballGroupRow[] {
  if (!groupLetter) return [];
  const group = WC2026_GROUPS.find((g) => g.letter === groupLetter);
  if (!group) return [];
  return group.teams.map((name, i) => ({
    team_name_fr: name, team_flag: "",
    rank: i + 1, played: 0, won: 0, draw: 0, lost: 0,
    goals_for: 0, goals_against: 0, goal_diff: 0, points: 0,
    wcForm: [],
  }));
}

type RawMatch = {
  id: string; team_a: string; team_b: string;
  flag_a: string | null; flag_b: string | null;
  score_a: number | null; score_b: number | null;
  status: string; starts_at: string; channel: string;
  phase: string | null; stage: string | null;
};

function computeGroupStandings(matches: RawMatch[]): FootballGroupRow[] {
  type T = {
    name: string; flag: string;
    played: number; won: number; draw: number; lost: number; gf: number; ga: number;
    form: Array<"W" | "D" | "L">;
  };
  const map = new Map<string, T>();
  const ensure = (name: string, flag: string | null): T => {
    if (!map.has(name)) map.set(name, { name, flag: flag ?? "", played: 0, won: 0, draw: 0, lost: 0, gf: 0, ga: 0, form: [] });
    return map.get(name)!;
  };
  const sorted = [...matches].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  for (const m of sorted) {
    const a = ensure(m.team_a, m.flag_a);
    const b = ensure(m.team_b, m.flag_b);
    if (m.status === "finished" && m.score_a != null && m.score_b != null) {
      a.played++; b.played++;
      a.gf += m.score_a; a.ga += m.score_b;
      b.gf += m.score_b; b.ga += m.score_a;
      if (m.score_a > m.score_b) {
        a.won++; b.lost++;
        a.form.push("W"); b.form.push("L");
      } else if (m.score_a < m.score_b) {
        b.won++; a.lost++;
        b.form.push("W"); a.form.push("L");
      } else {
        a.draw++; b.draw++;
        a.form.push("D"); b.form.push("D");
      }
    }
  }
  return [...map.values()]
    .map((t) => ({ ...t, diff: t.gf - t.ga, points: t.won * 3 + t.draw }))
    .sort((x, y) => y.points - x.points || (y.diff - x.diff) || y.gf - x.gf || x.name.localeCompare(y.name))
    .map((t, i) => ({
      team_name_fr: t.name, team_flag: t.flag, rank: i + 1,
      played: t.played, won: t.won, draw: t.draw, lost: t.lost,
      goals_for: t.gf, goals_against: t.ga, goal_diff: t.gf - t.ga, points: t.points,
      wcForm: t.form,
    }));
}

// ─── Fonction principale ─────────────────────────────────────────────────────

export async function getFootballTeamDashboard(slug: string): Promise<FootballTeamDashboard | null> {
  const wcTeam = getWCTeamBySlug(slug);
  if (!wcTeam) return null;

  const groupLetter = groupLetterForTeam(wcTeam.name);
  const fifaEntry = getFIFARank(wcTeam.name);

  try {
    const supabase = await createClient();
    const { data: allMatches } = await supabase
      .from("matches")
      .select("id, team_a, team_b, flag_a, flag_b, score_a, score_b, status, starts_at, channel, phase, stage")
      .order("starts_at", { ascending: true });

    const rows = (allMatches ?? []) as RawMatch[];

    // Matchs de l'équipe
    const teamMatches: WCMatchSummary[] = [];
    for (const m of rows) {
      const isHome = sameTeam(m.team_a, wcTeam.name);
      const isAway = !isHome && sameTeam(m.team_b, wcTeam.name);
      if (!isHome && !isAway) continue;

      let result: "W" | "D" | "L" | null = null;
      if (m.status === "finished" && m.score_a != null && m.score_b != null) {
        const myScore = isHome ? m.score_a : m.score_b;
        const oppScore = isHome ? m.score_b : m.score_a;
        result = myScore > oppScore ? "W" : myScore < oppScore ? "L" : "D";
      }
      teamMatches.push({
        id: m.id, teamHome: m.team_a, teamAway: m.team_b,
        flagHome: m.flag_a, flagAway: m.flag_b,
        scoreHome: m.score_a, scoreAway: m.score_b,
        status: m.status, startsAt: m.starts_at, channel: m.channel,
        isHome, result, phase: m.phase, stage: m.stage,
      });
    }

    const pastMatches = teamMatches.filter((m) => m.status === "finished");
    const upcomingMatches = teamMatches.filter((m) => m.status !== "finished");

    // Stats cumulées sur les matchs terminés
    const wcStats = { ...ZERO_STATS };
    for (const m of pastMatches) {
      wcStats.played++;
      const myGoals = m.isHome ? (m.scoreHome ?? 0) : (m.scoreAway ?? 0);
      const oppGoals = m.isHome ? (m.scoreAway ?? 0) : (m.scoreHome ?? 0);
      wcStats.goalsFor += myGoals;
      wcStats.goalsAgainst += oppGoals;
      if (m.result === "W") wcStats.won++;
      else if (m.result === "D") wcStats.draw++;
      else if (m.result === "L") wcStats.lost++;
    }
    wcStats.goalDiff = wcStats.goalsFor - wcStats.goalsAgainst;
    wcStats.points = wcStats.won * 3 + wcStats.draw;

    // Classement du groupe
    let groupStandings: FootballGroupRow[] = initGroupFromStatic(groupLetter);
    if (groupLetter) {
      const groupName = `Groupe ${groupLetter}`;
      const groupMatches = rows.filter((m) => m.phase === "Groupe" && m.stage === groupName);
      if (groupMatches.length > 0) {
        groupStandings = computeGroupStandings(groupMatches);
      }
    }

    return {
      wcTeam, groupLetter,
      fifaRank: fifaEntry?.rank ?? null,
      confederation: fifaEntry?.confederation ?? null,
      groupStandings, pastMatches, upcomingMatches, wcStats,
    };
  } catch {
    return {
      wcTeam, groupLetter,
      fifaRank: fifaEntry?.rank ?? null,
      confederation: fifaEntry?.confederation ?? null,
      groupStandings: initGroupFromStatic(groupLetter),
      pastMatches: [], upcomingMatches: [],
      wcStats: { ...ZERO_STATS },
    };
  }
}
