import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAuditList } from "@/lib/data/audit";

// Gating : admin + super_admin uniquement (cohérent avec /api/admin/users).
async function callerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const admin = createAdminClient();
  const { data } = await admin
    .from("allowlist_users")
    .select("role, is_active")
    .eq("email", user.email)
    .single();
  if (!data?.is_active) return false;
  return ["admin", "super_admin"].includes(data.role);
}

export async function GET() {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const data = await getUserAuditList();
  return NextResponse.json(data);
}
