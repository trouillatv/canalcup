"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, MessageCircle, Trophy, CircleUserRound, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/live",        icon: MessageCircle,    label: "Live" },
  { href: "/matches",     icon: Calendar,         label: "Matchs" },
  { href: "/leaderboard", icon: Trophy,           label: "Classement" },
  { href: "/bracket",     icon: LayoutGrid,       label: "Tournoi" },
  { href: "/profile",     icon: CircleUserRound,  label: "Profil" },
];

export function BottomNav() {
  const pathname = usePathname();

  // Pages "écran" sans chrome : TV, quiz plein écran (show/télécommande) et
  // pages publiques /p/* (QR codes). La nav masquait les boutons de la télécommande.
  if (
    pathname === "/tv" ||
    pathname === "/quiz-show" ||
    pathname === "/quiz-control" ||
    pathname.startsWith("/p/") ||
    pathname === "/cs" ||
    pathname.startsWith("/cs/")
  )
    return null;

  return (
    <nav className="bottom-nav z-50">
      <div className="flex items-center justify-around px-2 pt-2 pb-1">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 min-w-0",
                isActive
                  ? "text-canal-yellow"
                  : "text-canal-gray-muted hover:text-white"
              )}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={cn(
                  "transition-transform duration-150",
                  isActive && "scale-110"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-semibold",
                  isActive ? "text-canal-yellow" : "text-canal-gray-muted"
                )}
              >
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-0 w-1 h-1 bg-canal-yellow rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
