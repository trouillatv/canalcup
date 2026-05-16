// Client Gemini — Gemini 2.5 Flash pour minimiser les coûts
// Budget cible : < 30 € pour toute la compétition
// Règle : générer une fois, stocker en base, réutiliser

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

interface GeminiResponse {
  candidates: Array<{
    content: { parts: Array<{ text: string }> };
    finishReason: string;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export interface GeminiResult<T> {
  data: T;
  tokens: number;
  estimatedCostEur: number;
}

// Prix Gemini 2.0 Flash : ~$0.075 / 1M input tokens, ~$0.30 / 1M output tokens
const COST_PER_INPUT_TOKEN = 0.000000075;
const COST_PER_OUTPUT_TOKEN = 0.0000003;
const USD_TO_EUR = 0.92;

export async function callGemini<T>(prompt: string): Promise<GeminiResult<T>> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY manquante");

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }

  const json: GeminiResponse = await res.json();
  const text = json.candidates[0]?.content?.parts[0]?.text ?? "{}";
  const tokens = json.usageMetadata?.totalTokenCount ?? 0;
  const inputTokens = json.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = json.usageMetadata?.candidatesTokenCount ?? 0;

  const costUsd =
    inputTokens * COST_PER_INPUT_TOKEN + outputTokens * COST_PER_OUTPUT_TOKEN;
  const estimatedCostEur = costUsd * USD_TO_EUR;

  return {
    data: JSON.parse(text) as T,
    tokens,
    estimatedCostEur,
  };
}
