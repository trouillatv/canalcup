import { NextResponse } from "next/server";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";

export async function GET() {
  const [matches, trends] = await Promise.all([getMatches(), getPredictionTrends()]);
  return NextResponse.json({ matches, trends });
}
