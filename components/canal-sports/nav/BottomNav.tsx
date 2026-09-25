"use client";

// Navigation cible CANAL Sports — pilotée par le registre de feature flags.
// Un item disparaît de la nav dès que son flag passe OFF, sans supprimer
// le code de la page (voir lib/features/flags.ts). "Brief" n'a volontairement
// pas d'onglet dédié pour l'instant (cf. docs/adr/0002 — probablement intégré
// à l'Event Center en P4, pas décidé ici).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CalendarDays, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { isFeatureEnabled, type FeatureKey } from "@/lib/features/flags";

const NAV_ITEMS: { href: string; icon: typeof Home; label: string; feature?: FeatureKey }[] = [
  { href: "/cs", icon: Home, label: "Accueil" },
  { href: "/cs/programme", icon: CalendarDays, label: "Programme", feature: "program" },
  { href: "/cs/pronostics", icon: Target, label: "Pronostics", feature: "predictions" },
  { href: "/cs/classements", icon: Trophy, label: "Classements", feature: "rankings" },
];

export function CanalSportsBottomNav() {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((item) => !item.feature || isFeatureEnabled(item.feature));

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 min-w-0",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
