// GET /api/auth/pre-check?email=xxx
// Vérifie si un email est pré-approuvé dans l'allowlist, SANS auth.
// Retourne { allowed: boolean } uniquement (pas de détails pour éviter
// de leaker la composition de l'allowlist).

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEmail } from "@/lib/auth/email-domain";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("email") ?? "";
  const email = normalizeEmail(raw);
  if (!email) return NextResponse.json({ allowed: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from("allowlist_users")
    .select("is_active")
    .ilike("email", email)
    .maybeSingle();

  return NextResponse.json({ allowed: !!data?.is_active });
}
