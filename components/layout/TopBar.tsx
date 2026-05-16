"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

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
  "/admin/quiz": "Admin — Quiz",
  "/admin/matches": "Admin — Matchs",
  "/admin/teams": "Admin — Équipes",
  "/admin/morning-brief": "Admin — Matinale",
  "/admin/babyfoot": "Admin — Babyfoot",
};

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
    // Check admin role from allowlist
    const checkRole = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u?.email) return;
      const { data } = await supabase
        .from("allowlist_users")
        .select("role")
        .eq("email", u.email)
        .single();
      if (data?.role === "admin" || data?.role === "super_admin") {
        setIsAdmin(true);
      }
    };
    checkRole();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (pathname === "/tv") return null;

  const title = PAGE_TITLES[pathname] ?? "Canal Cup";
  const userInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canal-black/95 backdrop-blur-sm border-b border-canal-gray-light h-14 flex items-center px-4">
      <div className="flex items-center gap-2 flex-1">
        <span className="text-canal-yellow font-black text-xl tracking-tight">CANAL</span>
        <span className="text-white font-black text-xl tracking-tight">CUP</span>
        <span className="text-canal-gray-muted text-xl font-bold">2026</span>
      </div>

      <h1 className="absolute left-1/2 -translate-x-1/2 text-white font-bold text-sm">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        {isAdmin && (
          <Link
            href="/admin/quiz"
            className="p-2 text-canal-yellow hover:text-white transition-colors"
            aria-label="Admin"
          >
            <ShieldCheck size={18} />
          </Link>
        )}

        <Link
          href="/inbox"
          className="relative p-2 text-canal-gray-muted hover:text-white transition-colors"
          aria-label="Notifications"
        >
          <Bell size={20} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-canal-yellow rounded-full" />
        </Link>

        {user && (
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-7 h-7 rounded-full bg-canal-yellow flex items-center justify-center">
              <span className="text-canal-black font-black text-xs">{userInitial}</span>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-canal-gray-muted hover:text-red-400 transition-colors"
              aria-label="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
