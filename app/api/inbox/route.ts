import { getInboxEvents } from "@/lib/data/content";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") ?? undefined;
  const events = await getInboxEvents(userId);
  return NextResponse.json(events);
}
