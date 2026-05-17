// GET /api/tv/auth?pin=XXXX — vérifie le PIN TV mode
// Retourne 200 si PIN correct, 403 sinon
// TV_PIN défini dans les variables d'environnement Vercel

import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const pin = searchParams.get("pin") ?? "";
  const expected = process.env.TV_PIN ?? "";

  // En dev sans TV_PIN configuré, tout passe
  if (!expected) return NextResponse.json({ ok: true });

  if (pin === expected) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: "PIN invalide" }, { status: 403 });
}
