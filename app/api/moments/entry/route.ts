// POST /api/moments/entry — publie une photo/vidéo sur le Mur « Moments CanalCup ».
// multipart/form-data : { file, title?, category }. Ouvert à TOUT joueur connecté
// (binôme ou non). Aucun vote, aucun classement.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MOMENT_CATEGORY_KEYS } from "@/lib/moments/categories";
import { competitionLock } from "@/lib/event/status";

const BUCKET = "canalcup-moments";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 Mo
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

export async function POST(req: Request) {
  // 🔒 Canal Cup terminée → plus aucune écriture de jeu (403).
  const locked = await competitionLock();
  if (locked) return locked;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, display_name, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const file = form.get("file");
  const title = (form.get("title") as string | null)?.toString().slice(0, 120) ?? null;
  const category = (form.get("category") as string | null)?.toString() ?? "fun";
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
  if (!MOMENT_CATEGORY_KEYS.includes(category)) return NextResponse.json({ error: "Catégorie invalide." }, { status: 400 });

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type);
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "Format accepté : photo (JPG/PNG/WebP) ou vidéo (MP4/WebM/MOV)." }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "Vidéo trop lourde (60 Mo max)." }, { status: 400 });
  if (isImage && file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Photo trop lourde (8 Mo max)." }, { status: 400 });

  const mediaType = isVideo ? "video" : "image";
  const original = Buffer.from(await file.arrayBuffer());
  let bodyBuf: Buffer = original;
  let ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "jpg";
  let contentType = file.type;
  if (isImage) {
    try {
      const sharp = (await import("sharp")).default;
      bodyBuf = await sharp(original).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      ext = "webp";
      contentType = "image/webp";
    } catch {
      /* sharp indisponible → upload de l'original */
    }
  }

  const path = `${me.id}/${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bodyBuf, { contentType, upsert: true });
  if (upErr) return NextResponse.json({ error: `Upload impossible : ${upErr.message}` }, { status: 500 });
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  const authorName = me.display_name || me.name || "Un joueur";
  const { data: moment, error } = await admin
    .from("canalcup_moments")
    .insert({ user_id: me.id, author_name: authorName, title, category, photo_url: pub.publicUrl, media_type: mediaType, status: "visible" })
    .select("id, title, category, photo_url, media_type, created_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, moment });
}
