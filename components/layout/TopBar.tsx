"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, ShieldCheck, Home, Calendar, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Accueil" },
  { href: "/matches", icon: Calendar, label: "Matchs" },
  { href: "/leaderboard", icon: Trophy, label: "Classement" },
  { href: "/teams", icon: Users, label: "Équipes" },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    const checkRole = async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u?.email) return;
      const { data } = await supabase
        .from("allowlist_users")
        .select("role")
        .eq("email", u.email)
        .single();
      if (data?.role === "admin" || data?.role === "super_admin") setIsAdmin(true);
    };
    checkRole();
  }, []);

  const handleLogout = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (pathname === "/tv") return null;

  const userInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-canal-black/95 backdrop-blur-sm border-b border-canal-gray-light">
      {/* Ligne 1 : logo + actions */}
      <div className="h-14 flex items-center px-4">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-canal-yellow font-black text-xl tracking-tight">CANAL</span>
          <span className="text-white font-black text-xl tracking-tight">CUP</span>
          <span className="text-canal-gray-muted text-xl font-bold">2026</span>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/admin/quiz" className="p-2 text-canal-yellow hover:text-white transition-colors" aria-label="Admin">
              <ShieldCheck size={18} />
            </Link>
          )}
          <Link href="/inbox" className="relative p-2 text-canal-gray-muted hover:text-white transition-colors" aria-label="Notifications">
            <Bell size={20} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-canal-yellow rounded-full" />
          </Link>
          {user && (
            <div className="flex items-center gap-1.5 ml-1">
              <div className="w-7 h-7 rounded-full bg-canal-yellow flex items-center justify-center">
                <span className="text-canal-black font-black text-xs">{userInitial}</span>
              </div>
              <button onClick={handleLogout} className="p-1.5 text-canal-gray-muted hover:text-red-400 transition-colors" aria-label="Déconnexion">
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ligne 2 : navigation */}
      <div className="flex items-center border-t border-canal-gray-light/50">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors",
                isActive ? "text-canal-yellow" : "text-canal-gray-muted hover:text-white"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
