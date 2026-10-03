"use client";

// Navigation cible CANAL Sports — pilotée par le registre de feature flags.
// Un item disparaît de la nav dès que son flag passe OFF, sans supprimer
// le code de la page (voir lib/features/flags.ts). "Brief" n'a volontairement
// pas d'onglet dédié pour l'instant (cf. docs/adr/0002 — probablement intégré
// à l'Event Center en P4, pas décidé ici).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/features/flags";
import { CANAL_SPORTS_NAV_ITEMS } from "./items";

export function CanalSportsBottomNav() {
  const pathname = usePathname();
  const items = CANAL_SPORTS_NAV_ITEMS.filter((item) => !item.feature || isFeatureEnabled(item.feature));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm lg:hidden">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-all duration-150 active:scale-95",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={cn("transition-transform duration-150", isActive && "scale-110")}
              />
              <span className="text-[10px] font-semibold">{label}</span>
              {isActive && <span className="absolute bottom-0 h-1 w-1 rounded-full bg-primary motion-safe:animate-[cs-mobile-dot_160ms_ease-out]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
