import { createClient } from "@/lib/supabase/server";
import type { Challenge } from "@/lib/supabase/types";

export async function getChallenges(): Promise<Challenge[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("challenges")
      .select("*")
      .neq("status", "hidden")
      .order("sort_order", { ascending: true });
    if (error || !data?.length) return [];
    return data as Challenge[];
  } catch {
    return [];
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

    if (error || !data) return null;

    const challenge = data as Challenge;
    challenge.entries = (challenge.entries ?? [])
      .filter((e) => e.status !== "hidden")
      .sort((a, b) => b.points_awarded - a.points_awarded);
    return challenge;
  } catch {
    return null;
  }
}
