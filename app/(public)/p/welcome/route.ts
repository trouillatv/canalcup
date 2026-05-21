// /p/welcome — route handler "metal nu" qui sort COMPLÈTEMENT de l'App
// Router React. Pas de RootLayout, pas de TopBar, pas de scripts Canal Cup,
// pas de hydratation client. Juste un document HTML 100% standalone qui
// affiche /CDM-2026.jpeg plein écran. On voulait absolument que la page
// scannée par QR ne RESSEMBLE pas à l'app — c'est une affiche, pas un
// écran d'app.
//
// Le compteur est incrémenté côté serveur avant de retourner la réponse
// (RPC qr_increment).

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// Cookie présent = on a déjà vu ce navigateur récemment → on incrémente
// seulement les vues totales, pas les scans uniques.
const VISITOR_COOKIE = "cc_qr_welcome";
const VISITOR_TTL_DAYS = 30;

async function countVisit(isNewVisitor: boolean): Promise<void> {
  try {
    const supabase = createAdminClient();
    const rpc = isNewVisitor ? "qr_increment_unique" : "qr_increment";
    await supabase.rpc(rpc, { p_slug: "welcome" });
  } catch {
    /* compteur en panne ≠ page cassée */
  }
}

const HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#000000">
  <title>Coupe du Monde 2026</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      background: #000;
      overflow: hidden;
      -webkit-tap-highlight-color: transparent;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    img {
      max-width: 100vw;
      max-height: 100vh;
      width: auto;
      height: auto;
      object-fit: contain;
      user-select: none;
      -webkit-user-drag: none;
      pointer-events: none;
    }
  </style>
</head>
<body>
  <img src="/CDM-2026.jpeg" alt="Calendrier Coupe du Monde 2026">
</body>
</html>`;

export async function GET(req: NextRequest): Promise<Response> {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  const isNewVisitor = !existing;
  await countVisit(isNewVisitor);

  const res = new NextResponse(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

  if (isNewVisitor) {
    // UUID v4 minimaliste — pas besoin de crypto-secure pour un cookie d'unicité.
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    res.cookies.set({
      name: VISITOR_COOKIE,
      value: id,
      maxAge: 60 * 60 * 24 * VISITOR_TTL_DAYS,
      path: "/p/welcome",
      sameSite: "lax",
      httpOnly: false, // pas sensible — l'utilisateur peut le voir/supprimer
    });
  }

  return res;
}
