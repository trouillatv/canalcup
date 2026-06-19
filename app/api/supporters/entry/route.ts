// POST /api/supporters/entry — le binôme courant poste/modifie sa photo.
// multipart/form-data : { file: image, title?: string }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revokeAward, PARTICIPATION_LABEL } from "@/lib/supporters/service";

const BUCKET = "supporter-photos";
const MAX_BYTES = 8 * 1024 * 1024; // 8 Mo en entrée
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("users")
    .select("id, team_id, display_name, name")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  if (!me.team_id) return NextResponse.json({ error: "Trouve ton binôme pour participer." }, { status: 400 });

  // Photo verrouillée une fois les votes ouverts.
  const { data: settings } = await admin.from("supporter_settings").select("votes_open").eq("id", 1).maybeSingle();
  if (settings?.votes_open) {
    return NextResponse.json({ error: "Les votes sont ouverts : la photo n'est plus modifiable." }, { status: 400 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const file = form.get("file");
  const title = (form.get("title") as string | null)?.toString().slice(0, 120) ?? null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucune photo fournie." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Photo trop lourde (8 Mo max)." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: "Format accepté : JPG, PNG ou WebP." }, { status: 400 });

  // Compression best-effort (resize ≤1600px, webp q80). Fallback : original.
  const original = Buffer.from(await file.arrayBuffer());
  let body: Buffer = original;
  let ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  let contentType = file.type;
  try {
    const sharp = (await import("sharp")).default;
    body = await sharp(original).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    ext = "webp";
    contentType = "image/webp";
  } catch {
    /* sharp indisponible → upload de l'original */
  }

  const path = `${me.team_id}/${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (upErr) return NextResponse.json({ error: `Upload impossible : ${upErr.message}` }, { status: 500 });
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Une photo modifiée repasse en validation : on retire d'éventuels points de
  // participation déjà attribués sur l'ancienne photo de ce binôme.
  const { data: existing } = await admin
    .from("supporter_photo_entries")
    .select("id, participation_awarded")
    .eq("team_id", me.team_id)
    .maybeSingle();
  if (existing?.participation_awarded) {
    await revokeAward(admin, { sourceId: existing.id, label: PARTICIPATION_LABEL });
  }

  const { data: entry, error: entryErr } = await admin
    .from("supporter_photo_entries")
    .upsert(
      {
        team_id: me.team_id,
        uploaded_by_user_id: me.id,
        title,
        photo_url: pub.publicUrl,
        status: "submitted",
        participation_awarded: false,
        podium_rank: null,
        approved_at: null,
      },
      { onConflict: "team_id" }
    )
    .select("id, title, photo_url, status")
    .single();
  if (entryErr) return NextResponse.json({ error: entryErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, entry });
}
