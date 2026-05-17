// POST /api/admin/flash — créer un flash TV manuellement
// Body: { type, title, subtitle?, emoji?, expires_minutes? }
// Protected by x-admin-secret

import { NextResponse } from "next/server";
import { createFlash, type FlashType } from "@/lib/tv/flash";

const VALID_TYPES: FlashType[] = [
  "score_exact", "new_leader", "hall_of_shame", "fire",
  "chaos", "silence", "surprise", "reveal", "duel_serre",
];

export async function POST(req: Request) {
  const secret = req.headers.get("x-admin-secret");
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { type, title, subtitle, emoji, expires_minutes } = body;

  if (!type || !title) {
    return NextResponse.json({ error: "type et title requis" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: `type invalide. Valeurs : ${VALID_TYPES.join(", ")}` }, { status: 400 });
  }

  await createFlash(type as FlashType, title, subtitle, emoji, expires_minutes ?? 8);
  return NextResponse.json({ ok: true });
}
