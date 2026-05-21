// Page publique scannée via QR code — affiche l'affiche officielle
// COUPE DU MONDE 2026 (public/CDM-2026.jpeg) en grand, accessible
// SANS AUTHENTIFICATION (déclaré dans middleware.ts via /p prefix).
//
// À chaque page-view : RPC qr_increment('welcome') incrémente un
// compteur visible côté admin (/admin/qr). Pas de tracking IP/UA.
// Si Vincent observe trop de "refresh = +1", on ajoutera une dédupe
// par cookie (30 jours).

import Image from "next/image";
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
    <main className="min-h-screen bg-canal-black flex flex-col items-center justify-start py-6 px-3">
      <div className="w-full max-w-2xl space-y-4">
        <div className="text-center">
          <p className="text-canal-yellow font-black text-2xl tracking-tight">
            CANAL CUP <span className="text-white">2026</span>
          </p>
          <p className="text-canal-gray-muted text-xs mt-1">
            Coupe du Monde — à suivre en direct sur Canal+ et beIN Sports
          </p>
        </div>

        <div className="relative w-full overflow-hidden rounded-2xl border border-canal-gray-light bg-canal-gray-mid shadow-2xl">
          {/* width/height = ratio approx de l'affiche (4:5) ; next/image
              sert l'image optimisée avec srcset responsive automatique. */}
          <Image
            src="/CDM-2026.jpeg"
            alt="Calendrier Coupe du Monde 2026 — affiche officielle"
            width={720}
            height={1024}
            priority
            className="w-full h-auto"
          />
        </div>

        <p className="text-center text-canal-gray-muted text-[11px] italic">
          Garde-en une photo, partage-la, accroche-la dans ton bureau 🇫🇷⚽
        </p>
      </div>
    </main>
  );
}
