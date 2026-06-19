// Admin Jokers — vue d'ensemble + attribution / retrait.
//  GET  : joueurs + wallets, historique des plays, plus ciblés, cartons reçus,
//         effets actifs.
//  POST : { action: "grant" | "revoke", user_id, joker_type, quantity? }
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserRole } from "@/lib/auth/session";
import { getAdminEmails } from "@/lib/data/roles";
import { grantJoker, revokeJoker, getAllActiveEffects, expireStaleEffects } from "@/lib/jokers/service";
import { ALL_JOKER_TYPES, isJokerType } from "@/lib/jokers/catalog";

async function ensureAdmin(): Promise<boolean> {
  const role = await getCurrentUserRole();
  return role === "event_admin" || role === "admin" || role === "super_admin";
}

export async function GET() {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  await expireStaleEffects(admin);

  const [{ data: usersRaw }, { data: wallets }, { data: plays }, effects, adminEmails] =
    await Promise.all([
      admin.from("users").select("id, display_name, name, email, profile_completed"),
      admin.from("joker_wallets").select("user_id, joker_type, quantity"),
      admin
        .from("joker_plays")
        .select("id, joker_type, played_by_user_id, target_user_id, match_id, status, metadata, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      getAllActiveEffects(),
      getAdminEmails(),
    ]);

  const nameById = new Map(
    (usersRaw ?? []).map((u) => [u.id, u.display_name?.trim() || u.name?.trim() || "Joueur"])
  );

  // Joueurs (hors admins) + leurs wallets
  const walletByUser = new Map<string, Record<string, number>>();
  for (const w of wallets ?? []) {
    const m = walletByUser.get(w.user_id) ?? {};
    m[w.joker_type] = w.quantity;
    walletByUser.set(w.user_id, m);
  }
  const players = (usersRaw ?? [])
    .filter((u) => !adminEmails.has((u.email ?? "").toLowerCase()))
    .map((u) => ({
      id: u.id,
      name: u.display_name?.trim() || u.name?.trim() || "Joueur",
      wallet: walletByUser.get(u.id) ?? {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  // Historique enrichi
  const history = (plays ?? []).map((p) => ({
    ...p,
    playerName: nameById.get(p.played_by_user_id) ?? "Joueur",
    targetName: p.target_user_id ? nameById.get(p.target_user_id) ?? "Joueur" : null,
  }));

  // Plus ciblés + cartons reçus
  const targetedCount = new Map<string, number>();
  const redCardCount = new Map<string, number>();
  for (const p of plays ?? []) {
    if (p.target_user_id) {
      targetedCount.set(p.target_user_id, (targetedCount.get(p.target_user_id) ?? 0) + 1);
      if (p.joker_type === "carton_rouge") {
        redCardCount.set(p.target_user_id, (redCardCount.get(p.target_user_id) ?? 0) + 1);
      }
    }
  }
  const mostTargeted = [...targetedCount.entries()]
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? "Joueur", count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const redCards = [...redCardCount.entries()]
    .map(([id, count]) => ({ id, name: nameById.get(id) ?? "Joueur", count }))
    .sort((a, b) => b.count - a.count);

  const activeEffects = effects.map((e) => ({
    ...e,
    affectedName: nameById.get(e.affected_user_id) ?? "Joueur",
  }));

  return NextResponse.json(
    { players, jokerTypes: ALL_JOKER_TYPES, history, mostTargeted, redCards, activeEffects },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: Request) {
  if (!(await ensureAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { action, user_id, joker_type } = body;
  const quantity = Number.isFinite(body?.quantity) ? Math.max(1, Math.floor(body.quantity)) : 1;

  if (!user_id || !isJokerType(joker_type)) {
    return NextResponse.json({ error: "user_id et joker_type valides requis." }, { status: 400 });
  }
  if (action === "grant") {
    await grantJoker(user_id, joker_type, quantity);
  } else if (action === "revoke") {
    await revokeJoker(user_id, joker_type, quantity);
  } else {
    return NextResponse.json({ error: "action invalide (grant|revoke)." }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
