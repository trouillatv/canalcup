import { NextResponse } from "next/server";
import { callGemini } from "@/services/ai/gemini";
import { PROMPTS } from "@/services/ai/prompts";
import { createClient } from "@/lib/supabase/server";
import { recordCost } from "@/services/ai/cost-tracker";
import type { QuizCategory, QuizDifficulty } from "@/lib/supabase/types";

interface GeneratedQuestion {
  question: string;
  answer_a: string;
  answer_b: string;
  answer_c: string;
  answer_d: string;
  correct_answer: "A" | "B" | "C" | "D";
  fun_fact?: string;
}

export async function POST(req: Request) {
  const { category, difficulty, count = 1 } = await req.json() as {
    category: QuizCategory;
    difficulty: QuizDifficulty;
    count: number;
  };

  if (process.env.MOCK_AI === "true") {
    return NextResponse.json({
      error: "MOCK_AI=true — désactivez le mock pour appeler Gemini.",
      hint: "Changez MOCK_AI=false dans .env.local",
    }, { status: 400 });
  }

  const n = Math.min(Math.max(count, 1), 10);
  const generated: GeneratedQuestion[] = [];
  let totalCostEur = 0;

  for (let i = 0; i < n; i++) {
    const prompt = PROMPTS.quizQuestion({ category, difficulty });
    const result = await callGemini<GeneratedQuestion>(prompt);
    generated.push(result.data);
    totalCostEur += result.estimatedCostEur;
    recordCost("quiz_generation", result.tokens, result.estimatedCostEur);
  }

  const supabase = await createClient();
  const rows = generated.map((q) => ({
    question: q.question,
    answer_a: q.answer_a,
    answer_b: q.answer_b,
    answer_c: q.answer_c,
    answer_d: q.answer_d,
    correct_answer: q.correct_answer,
    difficulty,
    category,
  }));

  const { data, error } = await supabase
    .from("quiz_questions")
    .insert(rows)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    questions: data,
    count: data?.length ?? 0,
    costEur: Math.round(totalCostEur * 10000) / 10000,
  });
}
