// Admin settings CRUD — GET all settings, PATCH upsert a setting
// Protected by x-admin-secret header (PATCH only)

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function guard(req: Request): boolean {
  return req.headers.get("x-admin-secret") === process.env.ADMIN_SECRET;
}

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("app_settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: Request) {
  if (!guard(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = createAdminClient();
  const body = await req.json();
  const { key, value } = body;

  if (!key) return NextResponse.json({ error: "key requis" }, { status: 400 });

  const { data, error } = await supabase
    .from("app_settings")
    .upsert({ key, value })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
