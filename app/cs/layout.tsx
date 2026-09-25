// Layout du squelette CANAL Sports — isolé de app/layout.tsx et de la nav
// Canal Cup existante. Volontairement une section à part (/cs/*) plutôt
// qu'un remplacement de la racine : la racine reste le produit Canal Cup
// archivé (figé au tag world-cup-2026-final) tant que la bascule complète
// n'a pas été validée avec l'utilisateur (P2+).

import { CanalSportsTopBar } from "@/components/canal-sports/nav/TopBar";
import { CanalSportsBottomNav } from "@/components/canal-sports/nav/BottomNav";

export default function CanalSportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <CanalSportsTopBar />
      <main className="min-h-screen pt-14 pb-16">{children}</main>
      <CanalSportsBottomNav />
    </div>
  );
}
