// Attribution des Prix VAR MANUELS par le jury (Marie/Vincent).
//  POST { category_key, entry_id }  → assigne (toggle : re-clic sur la même
//        photo = retire). Une photo par catégorie (la clé est unique).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { isSupportersOrganizer, VAR_MANUAL_CATEGORIES } from "@/lib/supporters/access";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = await getCurrentUserRole();
  if (!isSupportersOrganizer(role, user.email)) {
    return NextResponse.json({ error: "Réservé aux organisateurs." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const categoryKey = typeof body?.category_key === "string" ? body.category_key : null;
  const entryId = typeof body?.entry_id === "string" ? body.entry_id : null;
  if (!categoryKey || !VAR_MANUAL_CATEGORIES.some((c) => c.key === categoryKey)) {
    return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });
  }
  if (!entryId) return NextResponse.json({ error: "entry_id requis." }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("supporter_var_awards")
    .select("entry_id")
    .eq("category_key", categoryKey)
    .maybeSingle();

  // Toggle : même photo déjà primée dans cette catégorie → on retire.
  if (existing?.entry_id === entryId) {
    await admin.from("supporter_var_awards").delete().eq("category_key", categoryKey);
    return NextResponse.json({ ok: true, assigned: false });
  }

  await admin
    .from("supporter_var_awards")
    .upsert({ category_key: categoryKey, entry_id: entryId }, { onConflict: "category_key" });
  return NextResponse.json({ ok: true, assigned: true });
}
