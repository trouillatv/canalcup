import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getAllUsersForAdmin, logAdminAction } from "@/lib/data/users";
import { isRequiredEmailDomain, normalizeEmail, REQUIRED_EMAIL_MESSAGE } from "@/lib/auth/email-domain";

async function getCallerEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.email ?? null;
}

async function callerIsAdmin(): Promise<string | null> {
  const email = await getCallerEmail();
  if (!email) return null;
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", email)
    .single();
  if (!data?.is_active) return null;
  if (!["admin", "super_admin"].includes(data.role)) return null;
  return email;
}

// GET — liste tous les utilisateurs
export async function GET() {
  const adminEmail = await callerIsAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const users = await getAllUsersForAdmin();
  return NextResponse.json(users);
}

// POST — inviter un nouvel utilisateur (ajoute à allowlist_users)
export async function POST(req: Request) {
  const adminEmail = await callerIsAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { email: rawEmail, role = "user" } = await req.json();
  const email = normalizeEmail(rawEmail ?? "");
  if (!email) return NextResponse.json({ error: "Email requis" }, { status: 400 });
  if (!isRequiredEmailDomain(email)) {
    return NextResponse.json({ error: REQUIRED_EMAIL_MESSAGE }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("allowlist_users")
    .insert({ email, role, is_active: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(adminEmail, "invite_user", email, { role });
  return NextResponse.json({ ok: true }, { status: 201 });
}
