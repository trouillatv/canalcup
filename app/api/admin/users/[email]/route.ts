import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { logAdminAction } from "@/lib/data/users";
import type { UserRole } from "@/lib/supabase/types";

async function callerIsAdmin(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const adminClient = createAdminClient();
  const { data } = await adminClient
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();
  if (!data?.is_active || !["admin", "super_admin"].includes(data.role)) return null;
  return user.email;
}

// PATCH — modifier rôle, service, is_active
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ email: string }> }
) {
  const adminEmail = await callerIsAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const { email } = await params;
  const targetEmail = decodeURIComponent(email);
  const body: { role?: UserRole; is_active?: boolean; service_id?: string } = await req.json();

  const adminClient = createAdminClient();
  const changes: Record<string, unknown> = {};

  // Mise à jour allowlist_users
  if (body.role !== undefined || body.is_active !== undefined) {
    const allowlistUpdate: Record<string, unknown> = {};
    if (body.role !== undefined) allowlistUpdate.role = body.role;
    if (body.is_active !== undefined) allowlistUpdate.is_active = body.is_active;

    const { error } = await adminClient
      .from("allowlist_users")
      .update(allowlistUpdate)
      .eq("email", targetEmail);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    Object.assign(changes, allowlistUpdate);
  }

  // Mise à jour public.users
  if (body.service_id !== undefined) {
    const { error } = await adminClient
      .from("users")
      .update({ service_id: body.service_id, updated_at: new Date().toISOString() })
      .eq("email", targetEmail);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    changes.service_id = body.service_id;
  }

  // Log admin
  const action = body.is_active === false ? "deactivate_user"
    : body.is_active === true ? "activate_user"
    : body.role ? "change_role"
    : "change_service";

  await logAdminAction(adminEmail, action, targetEmail, changes);

  return NextResponse.json({ ok: true });
}
