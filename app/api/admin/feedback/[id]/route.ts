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

const ALLOWED = new Set(["new", "read", "resolved"]);

// PATCH /api/admin/feedback/[id] — change le statut d'un retour.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const status = typeof body.status === "string" ? body.status : "";
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: "Statut invalide" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { error } = await admin.from("feedback").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/feedback/[id] — supprime un retour traité.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("feedback").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
