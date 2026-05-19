"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck, Menu, X, Home, Calendar, Trophy, Users, Tv, Inbox, Newspaper, Gamepad2, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";

const MENU_ITEMS = [
  { href: "/matches",    icon: Calendar,  label: "Matchs & Pronostics" },
  { href: "/teams",      icon: Users,     label: "Équipes" },
  { href: "/babyfoot",   icon: Gamepad2,  label: "Babyfoot" },
  { href: "/animations", icon: PartyPopper, label: "Animations" },
  { href: "/inbox",      icon: Inbox,     label: "Inbox" },
  { href: "/revivez",    icon: Newspaper, label: "Revivez" },
  { href: "/tv",         icon: Tv,        label: "Mode TV" },
];

export function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

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

  // Ferme le menu + rafraîchit le compteur de courriers non lus à chaque
  // changement de route (ex. après lecture de l'inbox, le badge se met à jour).
  useEffect(() => {
    setMenuOpen(false);
    fetch("/api/inbox/unread")
      .then((r) => r.json())
      .then((d) => setUnread(d.count ?? 0))
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  if (pathname === "/tv") return null;

  const userInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-canal-black/95 backdrop-blur-sm border-b border-canal-gray-light h-14 flex items-center px-4 gap-3">
        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="p-1.5 text-canal-gray-muted hover:text-white transition-colors"
          aria-label="Menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-1.5 flex-1">
          <Link href="/" className="flex items-center gap-1.5">
            <span className="text-canal-yellow font-black text-xl tracking-tight">CANAL</span>
            <span className="text-white font-black text-xl tracking-tight">CUP</span>
            <span className="text-canal-gray-muted text-xl font-bold">2026</span>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {user && (
            <div className="w-7 h-7 rounded-full bg-canal-yellow flex items-center justify-center">
              <span className="text-canal-black font-black text-xs">{userInitial}</span>
            </div>
          )}
        </div>
      </header>

      {/* Drawer overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Drawer */}
      <div className={cn(
        "fixed top-14 left-0 z-40 w-72 bg-canal-gray border-r border-canal-gray-light h-[calc(100vh-3.5rem)] transition-transform duration-200",
        menuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <nav className="p-3 space-y-1">
          <Link
            href="/"
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors",
              pathname === "/" ? "bg-canal-yellow/10 text-canal-yellow" : "text-canal-gray-muted hover:text-white hover:bg-canal-gray-mid"
            )}
          >
            <Home size={18} />
            Accueil
          </Link>

          <div className="pt-2 pb-1 px-4">
            <p className="text-xs text-canal-gray-muted font-bold uppercase tracking-wider">Navigation</p>
          </div>

          {MENU_ITEMS.map(({ href, icon: Icon, label }) => {
            const showBadge = href === "/inbox" && unread > 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-canal-yellow/10 text-canal-yellow"
                    : "text-canal-gray-muted hover:text-white hover:bg-canal-gray-mid"
                )}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {showBadge && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-canal-yellow text-canal-black text-xs font-black flex items-center justify-center tabular-nums">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}

          {isAdmin && (
            <>
              <div className="pt-2 pb-1 px-4">
                <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">Admin</p>
              </div>
              {[
                { href: "/admin/quiz", label: "Quiz" },
                { href: "/admin/matches", label: "Matchs" },
                { href: "/admin/teams", label: "Équipes" },
                { href: "/admin/challenges", label: "Animations" },
                { href: "/admin/babyfoot", label: "Babyfoot — matchs" },
                { href: "/admin/babyfoot/teams", label: "Babyfoot — équipes" },
                { href: "/admin/users", label: "Utilisateurs" },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-canal-gray-muted hover:text-canal-yellow hover:bg-canal-gray-mid transition-colors"
                >
                  <ShieldCheck size={14} />
                  {label}
                </Link>
              ))}
            </>
          )}

          {/* Déconnexion */}
          <div className="pt-4 mt-2 border-t border-canal-gray-light">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm text-canal-gray-muted hover:text-red-400 hover:bg-canal-gray-mid transition-colors"
            >
              <LogOut size={18} />
              Se déconnecter
            </button>
          </div>
        </nav>
      </div>
    </>
  );
}
