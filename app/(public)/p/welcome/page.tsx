// Page publique scannée via QR code — affiche l'affiche officielle
// COUPE DU MONDE 2026 (public/CDM-2026.jpeg) en PLEIN ÉCRAN, sans aucun
// chrome (pas de TopBar, pas de BottomNav, pas de header texte).
// Accessible SANS AUTHENTIFICATION (déclaré dans middleware.ts via /p prefix).
//
// L'image utilise position:fixed inset-0 + object-contain : elle prend
// tout l'écran disponible en gardant son ratio (pas de crop) et débordant
// jamais. Fond noir derrière les bandes éventuelles.
//
// À chaque page-view : RPC qr_increment('welcome') incrémente un
// compteur visible côté admin (/admin/qr). Pas de tracking IP/UA.

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function countVisit() {
  try {
    const supabase = createAdminClient();
    await supabase.rpc("qr_increment", { p_slug: "welcome" });
  } catch {
    /* compteur en panne ≠ page cassée — on laisse passer */
  }
}

export default async function QrWelcomePage() {
  // Fire-and-forget : on ne bloque pas le rendu sur l'increment.
  countVisit();

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center overflow-hidden">
      {/* On utilise <img> natif (pas next/image) pour qu'object-contain
          fonctionne sans plus de friction sur tous les navigateurs mobiles
          et que la balise prenne 100vw x 100vh sans calcul de ratio par
          next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/CDM-2026.jpeg"
        alt="Calendrier Coupe du Monde 2026"
        className="w-screen h-screen object-contain select-none"
        draggable={false}
      />
    </div>
  );
}
