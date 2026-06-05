import { NextResponse } from "next/server";
import { runCron } from "@/lib/monitoring/cron-log";
import { generateModerationReport } from "@/lib/social/moderation";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  return runCron("vestiaire-moderation", async () => {
    const report = await generateModerationReport();
    return {
      meta: {
        report_id: report.id,
        risk_level: report.risk_level,
        flagged_count: Array.isArray(report.flagged_items) ? report.flagged_items.length : 0,
      },
    };
  });
}
