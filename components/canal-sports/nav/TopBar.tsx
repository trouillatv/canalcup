"use client";

// TopBar minimale CANAL Sports — identité produit via lib/product/config.ts
// (pas de "Canal Cup"/"2026" en dur). Volontairement sans menu latéral pour
// l'instant : la nav cible tient dans la BottomNav (4 entrées max en P1).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { productConfig } from "@/lib/product/config";

export function CanalSportsTopBar() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const handleLogout = async () => {
    await fetch("/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border header-safe-top">
      <div className="h-14 flex items-center px-4 gap-3">
        <Link href="/cs" className="flex items-center gap-1.5 flex-1">
          <span className="text-primary font-black text-xl tracking-tight">
            {productConfig.shortName}
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-1.5">
            <Link
              href="/profile"
              aria-label="Mon profil"
              className="w-7 h-7 rounded-full bg-primary flex items-center justify-center hover:opacity-90 transition-opacity"
            >
              <span className="text-primary-foreground font-black text-xs">{userInitial}</span>
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="p-1.5 rounded-lg text-muted-foreground hover:text-canal-red hover:bg-muted transition-colors"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
