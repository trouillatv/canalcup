// POST    /api/supporters/entry — le binôme courant poste/modifie sa photo.
// DELETE  /api/supporters/entry — le binôme supprime SA photo (corriger une
//   erreur sans passer par un organisateur).
// multipart/form-data : { file: image, title?: string, slot?: main|bonus }
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardToTeam, revokeAward, PARTICIPATION_POINTS, PARTICIPATION_LABEL, podiumLabel } from "@/lib/supporters/service";
import { sendPushToAll } from "@/lib/push";
import { SUPPORTERS_PUSH_ENABLED, publishOpen } from "@/lib/supporters/access";

const BUCKET = "supporter-photos";
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 Mo
const MAX_VIDEO_BYTES = 60 * 1024 * 1024; // 60 Mo
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

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

  // Les publications n'ouvrent que demain (mardi) — verrou côté serveur.
  if (!publishOpen()) {
    return NextResponse.json({ error: "Les publications ouvrent demain (mardi). Reviens à ce moment-là 📸" }, { status: 400 });
  }

  // Pas de validation préalable pour cette animation : la photo est publiée et
  // visible immédiatement. Le remplacement reste possible tant que les
  // résultats ne sont pas publiés (modération a posteriori via « hide » admin).
  const { data: settings } = await admin
    .from("supporter_settings")
    .select("results_published")
    .eq("id", 1)
    .maybeSingle();
  if (settings?.results_published) {
    return NextResponse.json({ error: "Le concours est terminé : la photo n'est plus modifiable." }, { status: 400 });
  }

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  const file = form.get("file");
  const title = (form.get("title") as string | null)?.toString().slice(0, 120) ?? null;
  if (!(file instanceof File)) return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });

  const isVideo = ALLOWED_VIDEO.includes(file.type);
  const isImage = ALLOWED_IMAGE.includes(file.type);
  if (!isVideo && !isImage) {
    return NextResponse.json({ error: "Format accepté : photo (JPG/PNG/WebP) ou vidéo (MP4/WebM/MOV)." }, { status: 400 });
  }
  if (isVideo && file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: "Vidéo trop lourde (60 Mo max)." }, { status: 400 });
  if (isImage && file.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: "Photo trop lourde (8 Mo max)." }, { status: 400 });

  const mediaType = isVideo ? "video" : "image";
  const original = Buffer.from(await file.arrayBuffer());
  let body: Buffer = original;
  let ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "video/mp4" ? "mp4" : file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "jpg";
  let contentType = file.type;
  if (isImage) {
    // Compression best-effort (resize ≤1600px, webp q80). Fallback : original.
    try {
      const sharp = (await import("sharp")).default;
      body = await sharp(original).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
      ext = "webp";
      contentType = "image/webp";
    } catch {
      /* sharp indisponible → upload de l'original */
    }
  }
  /* vidéo : upload tel quel (pas de transcodage) */

  // Slot : photo PRINCIPALE (votable) ou 2e image BONUS du binôme. 2 images max.
  const slot = (form.get("slot") as string | null) === "bonus" ? "bonus" : "main";

  const SELECT = "id, title, photo_url, photo_url_2, status, media_type, media_type_2";
  const path = `${me.team_id}/${slot}-${Date.now()}.${ext}`;
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (upErr) return NextResponse.json({ error: `Upload impossible : ${upErr.message}` }, { status: 500 });
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Entrée existante du binôme ? (1 entrée votable par binôme, unique team_id.)
  const { data: existing } = await admin
    .from("supporter_photo_entries")
    .select("id, participation_awarded")
    .eq("team_id", me.team_id)
    .maybeSingle();

  // ── 2e image BONUS : ajout/remplacement sur l'entrée existante (non votée) ──
  if (slot === "bonus") {
    if (!existing) {
      return NextResponse.json(
        { error: "Postez d'abord la photo principale du binôme, puis ajoutez l'image bonus." },
        { status: 400 }
      );
    }
    const { data: entry, error } = await admin
      .from("supporter_photo_entries")
      .update({ photo_url_2: pub.publicUrl, media_type_2: mediaType })
      .eq("id", existing.id)
      .select(SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, entry, isNew: false, slot });
  }

  // ── Photo PRINCIPALE : update si l'entrée existe (préserve la bonus), sinon insert.
  const nowIso = new Date().toISOString();
  let entry: { id: string } | null = null;
  if (existing) {
    const { data, error } = await admin
      .from("supporter_photo_entries")
      .update({ uploaded_by_user_id: me.id, title, photo_url: pub.publicUrl, media_type: mediaType, status: "approved", approved_at: nowIso })
      .eq("id", existing.id)
      .select(SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    entry = data;
  } else {
    const { data, error } = await admin
      .from("supporter_photo_entries")
      .insert({ team_id: me.team_id, uploaded_by_user_id: me.id, title, photo_url: pub.publicUrl, media_type: mediaType, status: "approved", participation_awarded: false, approved_at: nowIso })
      .select(SELECT)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    entry = data;
  }

  // +10 participation (idempotent) à la première publication du binôme.
  const alreadyAwarded = !!existing?.participation_awarded;
  if (!alreadyAwarded && entry) {
    await awardToTeam(admin, {
      teamId: me.team_id,
      totalPoints: PARTICIPATION_POINTS,
      label: PARTICIPATION_LABEL,
      sourceId: entry.id,
      description: title ?? "Photo supporter",
    });
    await admin.from("supporter_photo_entries").update({ participation_awarded: true }).eq("id", entry.id);
  }

  // 🔔 Nouvelle photo = un événement : push à TOUT LE MONDE (sauf l'auteur).
  // Uniquement à la première publication du binôme (un remplacement ne spamme pas).
  // Préparé mais inactif tant que SUPPORTERS_PUSH_ENABLED est à false.
  const isNew = !existing;
  if (isNew && entry && SUPPORTERS_PUSH_ENABLED) {
    const teamLabel = me.display_name || me.name || "Un binôme";
    void sendPushToAll(
      {
        title: "📸 Nouvelle photo Journée Supporters !",
        body: title ? `${teamLabel} : « ${title} ». Va voter pour ta préférée 🗳️` : `${teamLabel} vient de poster. Va voter pour ta préférée 🗳️`,
        url: "/supporters",
      },
      { excludeAuthIds: [user.id] }
    ).catch((e) => console.error("[supporters/entry] push-to-all failed", e));
  }

  return NextResponse.json({ ok: true, entry, isNew, slot });
}

// ── DELETE : le binôme supprime SA photo (corriger une erreur sans organisateur).
// Retire photo principale + bonus + votes + réactions + commentaires + points de
// participation. Le binôme peut ensuite republier. Modération orga = séparée.
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id, team_id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  if (!me.team_id) return NextResponse.json({ error: "Aucun binôme." }, { status: 400 });

  // Concours figé une fois les résultats publiés.
  const { data: settings } = await admin.from("supporter_settings").select("results_published").eq("id", 1).maybeSingle();
  if (settings?.results_published) {
    return NextResponse.json({ error: "Le concours est terminé : la photo n'est plus supprimable." }, { status: 400 });
  }

  // Photo du binôme (1 entrée votable par team).
  const { data: entry } = await admin
    .from("supporter_photo_entries")
    .select("id")
    .eq("team_id", me.team_id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Aucune photo à supprimer." }, { status: 400 });

  // Retire les points (participation + podium éventuel) AVANT la suppression.
  await revokeAward(admin, { sourceId: entry.id, label: PARTICIPATION_LABEL });
  for (const r of [1, 2, 3]) await revokeAward(admin, { sourceId: entry.id, label: podiumLabel(r) });

  // Supprime votes / réactions / commentaires liés, puis l'entrée (photo
  // principale + bonus partent avec la ligne). Explicite, sans dépendre des cascades.
  await admin.from("supporter_photo_votes").delete().eq("entry_id", entry.id);
  await admin.from("supporter_photo_reactions").delete().eq("entry_id", entry.id);
  await admin.from("supporter_photo_comments").delete().eq("entry_id", entry.id);
  const { error } = await admin.from("supporter_photo_entries").delete().eq("id", entry.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// ── PATCH { action: "swap" } : échange la photo PRINCIPALE (votée) et la BONUS.
// Les votes/réactions/commentaires restent attachés à l'entrée (entry_id) — seul
// l'ordre d'affichage/le visuel voté change. Permet de « mettre en principal »
// une 2e photo sans rien perdre.
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "swap") return NextResponse.json({ error: "Action invalide." }, { status: 400 });

  const admin = createAdminClient();
  const { data: me } = await admin.from("users").select("id, team_id").eq("auth_id", user.id).maybeSingle();
  if (!me) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
  if (!me.team_id) return NextResponse.json({ error: "Aucun binôme." }, { status: 400 });

  const { data: settings } = await admin.from("supporter_settings").select("results_published").eq("id", 1).maybeSingle();
  if (settings?.results_published) {
    return NextResponse.json({ error: "Le concours est terminé : la photo n'est plus modifiable." }, { status: 400 });
  }

  const { data: entry } = await admin
    .from("supporter_photo_entries")
    .select("id, photo_url, photo_url_2, media_type, media_type_2")
    .eq("team_id", me.team_id)
    .maybeSingle();
  if (!entry) return NextResponse.json({ error: "Aucune photo." }, { status: 400 });
  if (!entry.photo_url_2) return NextResponse.json({ error: "Ajoute d'abord une 2e image, puis tu pourras la définir comme principale." }, { status: 400 });

  const { data: updated, error } = await admin
    .from("supporter_photo_entries")
    .update({
      photo_url: entry.photo_url_2,
      media_type: entry.media_type_2 ?? "image",
      photo_url_2: entry.photo_url,
      media_type_2: entry.media_type,
    })
    .eq("id", entry.id)
    .select("id, title, photo_url, photo_url_2, status, media_type, media_type_2")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, entry: updated });
}
