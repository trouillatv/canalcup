import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HallOfShameData {
  match_label: string;
  shame: Array<{ name: string; predicted: string }>;
}

export interface VisionnaireData {
  match_label: string;
  seers: string[];
}

export interface DramaData {
  name: string;
  team_name: string | null;
  delta: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function userName(u: { display_name?: string | null; name?: string | null } | null): string {
  return u?.display_name ?? u?.name ?? "Anonyme";
}

async function getLastFinishedMatch(supabase: SupabaseClient) {
  const since = new Date(Date.now() - 72 * 60 * 60_000).toISOString(); // 3 jours max
  const { data } = await supabase
    .from("matches")
    .select("id, team_a, team_b, score_a, score_b")
    .eq("status", "finished")
    .not("score_a", "is", null)
    .not("score_b", "is", null)
    .gte("starts_at", since)
    .order("starts_at", { ascending: false })
    .limit(1)
    .single();
  return data as { id: string; team_a: string; team_b: string; score_a: number; score_b: number } | null;
}

// ─── Hall of Shame : pires pronos score du dernier match ─────────────────────

export async function getHallOfShame(supabase: SupabaseClient): Promise<HallOfShameData | null> {
  try {
    const match = await getLastFinishedMatch(supabase);
    if (!match) return null;

    const { data: preds } = await supabase
      .from("predictions")
      .select("user_id, team_id, predicted_score_a, predicted_score_b")
      .eq("match_id", match.id)
      .not("predicted_score_a", "is", null)
      .not("predicted_score_b", "is", null);

    if (!preds?.length) return null;

    const withError = preds
      .map((p) => ({
        user_id: p.user_id as string,
        team_id: p.team_id as string | null,
        predicted_score_a: p.predicted_score_a as number,
        predicted_score_b: p.predicted_score_b as number,
        error:
          Math.abs(p.predicted_score_a - match.score_a) +
          Math.abs(p.predicted_score_b - match.score_b),
      }))
      .filter((p) => p.error >= 3)
      .sort((a, b) => b.error - a.error)
      .slice(0, 3);

    if (!withError.length) return null;

    const teamIds = [...new Set(withError.map((p) => p.team_id).filter(Boolean))] as string[];

    const [usersResult, teamsResult] = await Promise.all([
      supabase.from("users").select("id, display_name, name").in("id", withError.map((p) => p.user_id)),
      teamIds.length ? supabase.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const nameMap = new Map((usersResult.data ?? []).map((u) => [u.id, userName(u)]));
    const teamMap = new Map((teamsResult.data ?? []).map((t) => [t.id, t.name as string]));

    return {
      match_label: `${match.team_a} ${match.score_a}–${match.score_b} ${match.team_b}`,
      shame: withError.map((p) => ({
        name: nameMap.get(p.user_id) ?? (p.team_id ? teamMap.get(p.team_id) : null) ?? "Anonyme",
        predicted: `${p.predicted_score_a}–${p.predicted_score_b}`,
      })),
    };
  } catch {
    return null;
  }
}

// ─── Visionnaire : score exact trouvé ────────────────────────────────────────

export async function getVisionnaire(supabase: SupabaseClient): Promise<VisionnaireData | null> {
  try {
    const match = await getLastFinishedMatch(supabase);
    if (!match) return null;

    const { data: preds } = await supabase
      .from("predictions")
      .select("user_id, team_id")
      .eq("match_id", match.id)
      .eq("predicted_score_a", match.score_a)
      .eq("predicted_score_b", match.score_b);

    if (!preds?.length) return null;

    const teamIds = [...new Set(preds.map((p) => p.team_id).filter(Boolean))] as string[];
    const [usersResult, teamsResult] = await Promise.all([
      supabase.from("users").select("id, display_name, name").in("id", preds.map((p) => p.user_id as string)),
      teamIds.length ? supabase.from("teams").select("id, name").in("id", teamIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const teamMap = new Map((teamsResult.data ?? []).map((t) => [t.id, t.name as string]));

    const seers = preds.map((p) => {
      const u = (usersResult.data ?? []).find((u) => u.id === p.user_id);
      return userName(u ?? null) !== "Anonyme"
        ? userName(u ?? null)
        : (p.team_id ? teamMap.get(p.team_id as string) : null) ?? "Anonyme";
    }).filter((n) => n !== "Anonyme");
    if (!seers.length) return null;

    return {
      match_label: `${match.team_a} ${match.score_a}–${match.score_b} ${match.team_b}`,
      seers,
    };
  } catch {
    return null;
  }
}

// ─── Drama : plus grand gain de points en 24h ────────────────────────────────

export async function getDrama(supabase: SupabaseClient): Promise<DramaData | null> {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const { data: events } = await supabase
      .from("score_events")
      .select("user_id, raw_points")
      .gte("created_at", since)
      .not("user_id", "is", null);

    if (!events?.length) return null;

    const byUser: Record<string, number> = {};
    for (const e of events) {
      if (!e.user_id) continue;
      byUser[e.user_id] = (byUser[e.user_id] ?? 0) + (e.raw_points ?? 0);
    }

    const sorted = Object.entries(byUser).sort(([, a], [, b]) => b - a);
    if (!sorted.length || sorted[0][1] < 10) return null;

    const [topId, delta] = sorted[0];
    const { data: user } = await supabase
      .from("users")
      .select("display_name, name, team_id")
      .eq("id", topId)
      .single();

    if (!user) return null;

    let teamName: string | null = null;
    if (user.team_id) {
      const { data: team } = await supabase
        .from("teams")
        .select("name")
        .eq("id", user.team_id)
        .single();
      teamName = team?.name ?? null;
    }

    return { name: userName(user), team_name: teamName, delta };
  } catch {
    return null;
  }
}

// ─── Fantômes : joueurs inactifs depuis 7 jours ───────────────────────────────

export async function getFantomes(supabase: SupabaseClient): Promise<string[]> {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60_000).toISOString();
    const { data } = await supabase
      .from("users")
      .select("display_name, name")
      .eq("profile_completed", true)
      .not("team_id", "is", null)
      .or(`last_login_at.is.null,last_login_at.lt.${sevenDaysAgo}`)
      .order("last_login_at", { ascending: true });
    // Tous les fantômes (plus de limite à 5).

    return (data ?? []).map(userName).filter(Boolean);
  } catch {
    return [];
  }
}
