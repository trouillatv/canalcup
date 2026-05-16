import { createClient } from "@/lib/supabase/server";
import {
  MOCK_MORNING_BRIEF, MOCK_REVIVEZ, MOCK_BABYFOOT, MOCK_QUIZ, MOCK_INBOX
} from "@/lib/mock-data";
import type { MorningBrief, RevivezPost, BabyFootMatch, QuizQuestion, InboxEvent } from "@/lib/supabase/types";

export async function getTodayBrief(): Promise<MorningBrief> {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("morning_briefs")
      .select("*")
      .eq("date", today)
      .single();
    if (!data) {
      // Fallback : dernière matinale disponible
      const { data: latest } = await supabase
        .from("morning_briefs")
        .select("*")
        .order("date", { ascending: false })
        .limit(1)
        .single();
      return (latest as MorningBrief) ?? MOCK_MORNING_BRIEF;
    }
    return data as MorningBrief;
  } catch {
    return MOCK_MORNING_BRIEF;
  }
}

export async function getRevivezPosts(): Promise<RevivezPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("revivez_posts")
      .select("*, team:teams(id, name, slogan)")
      .order("votes_count", { ascending: false });
    if (error || !data?.length) return MOCK_REVIVEZ;
    return data as RevivezPost[];
  } catch {
    return MOCK_REVIVEZ;
  }
}

export async function getBabyFootMatches(): Promise<BabyFootMatch[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("babyfoot_matches")
      .select("*, team_a:teams!team_a_id(id, name, slogan), team_b:teams!team_b_id(id, name, slogan)")
      .order("starts_at", { ascending: true });
    if (error || !data?.length) return MOCK_BABYFOOT;
    return data as BabyFootMatch[];
  } catch {
    return MOCK_BABYFOOT;
  }
}

export async function getQuizQuestions(): Promise<QuizQuestion[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("quiz_questions")
      .select("*")
      .order("created_at", { ascending: true });
    if (error || !data?.length) return MOCK_QUIZ;
    return data as QuizQuestion[];
  } catch {
    return MOCK_QUIZ;
  }
}

export async function getInboxEvents(userId?: string): Promise<InboxEvent[]> {
  try {
    if (!userId) return MOCK_INBOX;
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("inbox_events")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error || !data?.length) return MOCK_INBOX;
    return data as InboxEvent[];
  } catch {
    return MOCK_INBOX;
  }
}
