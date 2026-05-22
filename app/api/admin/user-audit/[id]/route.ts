import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserAuditDetail } from "@/lib/data/audit";

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

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  const detail = await getUserAuditDetail(id);
  if (!detail) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  return NextResponse.json(detail);
}
