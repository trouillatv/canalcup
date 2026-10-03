"use client";

// Desktop keeps the current CANAL Sports direction. Mobile restores the compact
// Canal Cup shell pattern: hamburger, product mark, notification/avatar/logout.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, Download, LogOut, Menu, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { productConfig } from "@/lib/product/config";
import { cn } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/features/flags";
import { CANAL_SPORTS_NAV_ITEMS } from "./items";

export function CanalSportsTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pushState, setPushState] = useState<"unknown" | "subscribed" | "denied" | "unsupported" | "idle">("unknown");
  const navItems = CANAL_SPORTS_NAV_ITEMS.filter((item) => !item.feature || isFeatureEnabled(item.feature));

  const refreshPushState = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      setPushState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setPushState("denied");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushState(sub ? "subscribed" : "idle");
    } catch {
      setPushState("idle");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  useEffect(() => {
    if (user) refreshPushState();
  }, [refreshPushState, user]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const togglePush = async () => {
    if (pushState === "unsupported" || pushState === "denied") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (pushState === "subscribed") {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await sub.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
        }
        setPushState("idle");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState("denied");
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      setPushState("subscribed");
    } catch {
      setPushState("idle");
    }
  };

  const handleLogout = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border header-safe-top">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:gap-4 lg:px-8">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <Link href="/cs" className="flex min-w-0 flex-1 items-center gap-1.5 lg:flex-none">
            <span className="truncate text-xl font-black tracking-tight text-primary">
              {productConfig.shortName}
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 lg:flex" aria-label="Navigation CANAL Sports">
            {navItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon size={15} strokeWidth={isActive ? 2.5 : 2} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {user && (
            <div className="flex items-center gap-1.5">
              {pushState !== "unsupported" && (
                <button
                  type="button"
                  onClick={togglePush}
                  aria-label={pushState === "subscribed" ? "Desactiver les notifications" : "Activer les notifications"}
                  title={pushState === "subscribed" ? "Notifications activees" : "Activer les notifications"}
                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {pushState === "subscribed" ? (
                    <BellRing size={16} className="text-primary" />
                  ) : (
                    <Bell size={16} className={pushState === "denied" ? "text-canal-red/55" : ""} />
                  )}
                </button>
              )}
              <Link
                href="/profile"
                aria-label="Mon profil"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary transition-opacity hover:opacity-90"
              >
                <span className="text-xs font-black text-primary-foreground">{userInitial}</span>
              </Link>
              <button
                onClick={handleLogout}
                aria-label="Se deconnecter"
                title="Se deconnecter"
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-canal-red"
              >
                <LogOut size={16} />
              </button>
            </div>
          )}
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 z-40 w-72 border-r border-border bg-card transition-transform duration-200 ease-out lg:hidden",
          "top-[calc(3.5rem+env(safe-area-inset-top,0px))] h-[calc(100dvh-3.5rem-env(safe-area-inset-top,0px))]",
          menuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="h-full space-y-1 overflow-y-auto p-3 pb-6" aria-label="Menu mobile CANAL Sports">
          <div className="px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-primary">Navigation</p>
          </div>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            );
          })}
          <Link
            href="/install"
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Download size={18} />
            Installer l'app
          </Link>
        </nav>
      </aside>
    </>
  );
}
