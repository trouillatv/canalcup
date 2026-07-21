// POST /api/babyfoot/photo — ajoute une photo au tournoi (après un match, ou
// générale). multipart/form-data : { file, match_id?, caption? }. Ouvert à tout
// joueur connecté. Modèle repris de /api/moments/entry (upload admin + sharp→webp).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveOfficialTournament } from "@/lib/data/babyfoot";
import { competitionLock } from "@/lib/event/status";

const BUCKET = "babyfoot-photos";
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id, display_name, name, team_id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  const t = await getActiveOfficialTournament(admin);
  if (!t) return NextResponse.json({ error: "Aucun tournoi actif." }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const file = form.get("file");
  const matchId = (form.get("match_id") as string | null)?.toString() || null;
  const caption = (form.get("caption") as string | null)?.toString().slice(0, 140) || null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Format : JPG, PNG ou WebP." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo trop lourde (8 Mo max)." }, { status: 400 });

  const original = Buffer.from(await file.arrayBuffer());
  let body: Buffer = original;
  let ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  let contentType = file.type;
  try {
    const sharp = (await import("sharp")).default;
    body = await sharp(original).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    ext = "webp"; contentType = "image/webp";
  } catch { /* sharp absent → original */ }

  const path = `${t.id}/${me.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (upErr) return NextResponse.json({ error: `Upload impossible : ${upErr.message}` }, { status: 500 });
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const { data: photo, error } = await admin.from("babyfoot_match_photos").insert({
    tournament_id: t.id, match_id: matchId, team_id: me.team_id ?? null, user_id: me.id,
    author_name: me.display_name || me.name || "Un joueur", photo_url: pub.publicUrl, caption, status: "visible",
  }).select("id, photo_url, caption, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, photo });
}
