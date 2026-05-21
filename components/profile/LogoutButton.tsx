"use client";

// Bouton "Se déconnecter" visible directement sur /profile.
// Doublon volontaire du logout présent dans le drawer hamburger — beaucoup
// d'utilisateurs Canal Cup ne pensent pas à ouvrir le menu pour se
// déconnecter (le hamburger sert surtout à naviguer). Mieux vaut deux
// entrées qu'aucune.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch("/auth/signout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* tente quand même la redirection */
    }
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-red-400 bg-red-950/30 border border-red-500/30 hover:bg-red-950/50 transition-colors disabled:opacity-50"
    >
      <LogOut size={14} />
      {loading ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
