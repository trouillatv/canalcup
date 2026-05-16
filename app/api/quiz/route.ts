import { getQuizQuestions } from "@/lib/data/content";
import { NextResponse } from "next/server";

export const revalidate = 300;

export async function GET() {
  const questions = await getQuizQuestions();
  return NextResponse.json(questions);
}
