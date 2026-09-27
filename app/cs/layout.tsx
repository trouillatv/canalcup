// Layout du squelette CANAL Sports — isolé de app/layout.tsx et de la nav
// Canal Cup existante. Volontairement une section à part (/cs/*) plutôt
// qu'un remplacement de la racine : la racine reste le produit Canal Cup
// archivé (figé au tag world-cup-2026-final) tant que la bascule complète
// n'a pas été validée avec l'utilisateur (P2+).
//
// `metadata` ci-dessous remplace (ne fusionne pas) le titre/manifest hérités
// de app/layout.tsx pour tout /cs/* — sinon l'onglet navigateur et
// l'installation PWA afficheraient "Canal Cup 2026" pour un utilisateur
// CANAL Sports (sweep rebranding, voir AUDIT-CANAL-SPORTS.md).

import type { Metadata } from "next";
import { CanalSportsTopBar } from "@/components/canal-sports/nav/TopBar";
import { CanalSportsBottomNav } from "@/components/canal-sports/nav/BottomNav";
import { productConfig } from "@/lib/product/config";

export const metadata: Metadata = {
  title: productConfig.name,
  description: productConfig.tagline,
  manifest: "/cs-manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: productConfig.shortName,
    startupImage: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    title: productConfig.name,
    description: productConfig.tagline,
    type: "website",
  },
};

export default function CanalSportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <CanalSportsTopBar />
      <main className="min-h-screen pt-14 pb-16">{children}</main>
      <CanalSportsBottomNav />
    </div>
  );
}
