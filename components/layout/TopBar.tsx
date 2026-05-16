"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Canal Cup",
  "/matches": "Matchs",
  "/teams": "Équipes",
  "/leaderboard": "Classement",
  "/matinale": "Matinale",
  "/revivez": "Revivez",
  "/babyfoot": "Babyfoot",
  "/quiz-live": "Quiz Live",
  "/inbox": "Inbox",
  "/tv": "Mode TV",
};

export function TopBar() {
  const pathname = usePathname();

  if (pathname === "/tv") return null;

  const title = PAGE_TITLES[pathname] ?? "Canal Cup";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canal-black/95 backdrop-blur-sm border-b border-canal-gray-light h-14 flex items-center px-4">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-canal-yellow font-black text-xl tracking-tight">
          CANAL
        </span>
        <span className="text-white font-black text-xl tracking-tight">CUP</span>
        <span className="text-canal-gray-muted text-xl font-bold">2026</span>
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-sm">
        {title}
      </h1>

      <div className="flex items-center gap-3">
        <Link
          href="/inbox"
          className="relative p-2 text-canal-gray-muted hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {/* Badge non-lus — à connecter Supabase */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-canal-yellow rounded-full" />
        </Link>
      </div>
    </header>
  );
}
