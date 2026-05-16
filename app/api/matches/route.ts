import { NextResponse, after } from "next/server";
import { getMatches, getPredictionTrends } from "@/lib/data/matches";
import { settleAllFinished } from "@/services/scoring/settle";
import { syncLiveScores } from "@/services/football";

export async function GET() {
  const [matches, trends] = await Promise.all([getMatches(), getPredictionTrends()]);

  // After response is sent: sync live scores then settle any newly finished matches
  // This replaces the "cron once a day" for settlements — fires on every page load, cheap
  const hasLiveOrRecentlyFinished = matches.some(
    (m) => m.status === "live" || m.status === "halftime" ||
    (m.status === "finished" && !("is_settled" in m ? m.is_settled : true))
  );

  if (hasLiveOrRecentlyFinished) {
    after(async () => {
      await syncLiveScores();
      await settleAllFinished();
    });
  } else {
    // Always check for unsettled matches regardless (cheap query)
    after(() => settleAllFinished());
  }

  return NextResponse.json({ matches, trends });
}
