// Cache IA — stocker les résultats en Supabase, ne jamais appeler Gemini à chaque refresh

import { createClient } from "@/lib/supabase/server";

export async function getCachedAIContent(
  type: string,
  date?: string
): Promise<string | null> {
  const supabase = await createClient();
  const query = supabase
    .from("ai_contents")
    .select("result")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1);

  if (date) {
    query.gte("created_at", `${date}T00:00:00`).lte("created_at", `${date}T23:59:59`);
  }

  const { data } = await query.single();
  return data?.result ?? null;
}

export async function storeAIContent(
  type: string,
  prompt: string,
  result: string,
  model: string,
  costEstimate: number
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_contents").insert({
    type,
    prompt,
    result,
    model,
    cost_estimate: costEstimate,
    created_at: new Date().toISOString(),
  });
}

export async function getTotalAICost(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_contents")
    .select("cost_estimate");
  return (data ?? []).reduce((sum, row) => sum + (row.cost_estimate ?? 0), 0);
}
