import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRequiredEmailDomain, normalizeEmail, REQUIRED_EMAIL_MESSAGE } from "@/lib/auth/email-domain";

// Route DEV ONLY — génère un magic link sans envoyer d'email
// Jamais disponible en production
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Non disponible en production" }, { status: 403 });
  }

  const { email: rawEmail } = await req.json();
  const email = normalizeEmail(rawEmail ?? "");
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });
  if (!isRequiredEmailDomain(email)) {
    return NextResponse.json({ error: REQUIRED_EMAIL_MESSAGE }, { status: 400 });
  }

  const adminClient = createAdminClient();
  // Utilise l'origin de la requête pour être correct quel que soit le port dev
  const origin = new URL(req.url).origin;

  const { data, error } = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ link: data?.properties?.action_link });
}
