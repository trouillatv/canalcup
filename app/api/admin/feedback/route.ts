import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

// GET /api/admin/feedback — liste tous les retours (admin only).
export async function GET() {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("feedback")
    .select("id, user_id, email, display_name, message, page, status, created_at")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
