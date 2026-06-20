"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function BackButton({ fallback = "/matches" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      aria-label="Retour"
      className="flex items-center gap-1.5 text-canal-gray-muted hover:text-white transition-colors"
    >
      <ArrowLeft size={18} />
      <span className="text-sm font-bold">Retour</span>
    </button>
  );
}
