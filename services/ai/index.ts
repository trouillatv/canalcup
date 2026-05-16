// Abstraction IA Canal Cup
// MOCK_AI=true → mock, sinon Gemini 2.5 Flash
// Règle d'or : générer une fois, stocker, réutiliser

import { PROMPTS } from "./prompts";
import { callGemini } from "./gemini";
import {
  mockMorningBrief,
  mockTeamRoast,
  mockQuizQuestion,
  mockFailCaption,
  mockWeeklyStory,
} from "./mock";
import { getCachedAIContent, storeAIContent } from "./cache";

const isMock = process.env.MOCK_AI === "true" || !process.env.GEMINI_API_KEY;

export async function generateMorningBrief(context: {
  date: string;
  scores: string;
  leaderboard: string;
  failTeam: string;
  matchTonight: string;
}) {
  if (isMock) return mockMorningBrief();

  const cached = await getCachedAIContent("morning_brief", context.date);
  if (cached) return JSON.parse(cached);

  const prompt = PROMPTS.morningBrief(context);
  const result = await callGemini<ReturnType<typeof mockMorningBrief>>(prompt);

  await storeAIContent(
    "morning_brief",
    prompt,
    JSON.stringify(result.data),
    "gemini-2.0-flash",
    result.estimatedCostEur
  );

  return result.data;
}

export async function generateTeamRoast(team: {
  name: string;
  slogan: string;
  recentResults: string;
}) {
  if (isMock) return mockTeamRoast(team.name);

  const cacheKey = `team_roast_${team.name}`;
  const cached = await getCachedAIContent(cacheKey);
  if (cached) return JSON.parse(cached);

  const prompt = PROMPTS.teamRoast(team);
  const result = await callGemini<ReturnType<typeof mockTeamRoast>>(prompt);

  await storeAIContent(
    cacheKey,
    prompt,
    JSON.stringify(result.data),
    "gemini-2.0-flash",
    result.estimatedCostEur
  );

  return result.data;
}

export async function generateQuizQuestion(context: {
  category: string;
  difficulty: string;
}) {
  if (isMock) return mockQuizQuestion();

  const prompt = PROMPTS.quizQuestion(context);
  const result = await callGemini<ReturnType<typeof mockQuizQuestion>>(prompt);

  await storeAIContent(
    "quiz_question",
    prompt,
    JSON.stringify(result.data),
    "gemini-2.0-flash",
    result.estimatedCostEur
  );

  return result.data;
}

export async function generateFailCaption(context: {
  teamName: string;
  prediction: string;
  result: string;
}) {
  if (isMock) return mockFailCaption();

  const prompt = PROMPTS.failCaption(context);
  const result = await callGemini<string>(prompt);

  await storeAIContent(
    "fail_caption",
    prompt,
    String(result.data),
    "gemini-2.0-flash",
    result.estimatedCostEur
  );

  return result.data;
}

export async function generateWeeklyStory(context: {
  topTeam: string;
  bottomTeam: string;
  bestPrediction: string;
  worstPrediction: string;
}) {
  if (isMock) return mockWeeklyStory();

  const prompt = PROMPTS.weeklyStory(context);
  const result = await callGemini<ReturnType<typeof mockWeeklyStory>>(prompt);

  await storeAIContent(
    "weekly_story",
    prompt,
    JSON.stringify(result.data),
    "gemini-2.0-flash",
    result.estimatedCostEur
  );

  return result.data;
}
