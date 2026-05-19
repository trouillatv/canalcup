import { createClient } from "@/lib/supabase/server";
import { MOCK_CHALLENGES, MOCK_CHALLENGE_ENTRIES } from "@/lib/mock-data";
import type { Challenge } from "@/lib/supabase/types";

// Lecture seule, fallback mock — même contrat que lib/data/content.ts.
// Le scoring s'écrit dans score_events (cf. /api/admin/challenges), jamais ici.

export async function getChallenges(): Promise<Challenge[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("challenges")
      .select("*")
      .neq("status", "hidden")
      .order("sort_order", { ascending: true });
    if (error || !data?.length) return MOCK_CHALLENGES;
    return data as Challenge[];
  } catch {
    return MOCK_CHALLENGES;
  }
}

export async function getChallengeBySlug(slug: string): Promise<Challenge | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("challenges")
      .select(`
        *,
        entries:challenge_entries(
          *,
          team:teams(id, name, slogan, color)
        )
      `)
      .eq("slug", slug)
      .single();

    if (error || !data) {
      const mock = MOCK_CHALLENGES.find((c) => c.slug === slug);
      if (!mock) return null;
      return {
        ...mock,
        entries: MOCK_CHALLENGE_ENTRIES.filter((e) => e.challenge_id === mock.id),
      };
    }

    const challenge = data as Challenge;
    // N'expose pas les participations masquées côté public, classe par points.
    challenge.entries = (challenge.entries ?? [])
      .filter((e) => e.status !== "hidden")
      .sort((a, b) => b.points_awarded - a.points_awarded);
    return challenge;
  } catch {
    const mock = MOCK_CHALLENGES.find((c) => c.slug === slug);
    if (!mock) return null;
    return {
      ...mock,
      entries: MOCK_CHALLENGE_ENTRIES.filter((e) => e.challenge_id === mock.id),
    };
  }
}
