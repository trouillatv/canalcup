"use client";

// Error boundary par segment (sous TopBar/BottomNav). Affiche le VRAI
// message d'erreur pour faciliter le diagnostic mobile.

import { useEffect } from "react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log côté console aussi (utile en desktop / via remote debugging).
    // eslint-disable-next-line no-console
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="px-4 py-8 max-w-md mx-auto">
      <div className="canal-card border border-red-700/50">
        <h1 className="text-canal-yellow font-black text-lg mb-2">
          ⚠️ Erreur — cette page n&apos;a pas pu se charger
        </h1>
        <p className="text-canal-gray-muted text-xs mb-3">
          Copie ce message pour qu&apos;on corrige :
        </p>
        <pre className="text-xs text-red-300 bg-canal-gray-mid border border-canal-gray-light rounded-lg p-3 whitespace-pre-wrap break-words overflow-x-auto">
{error?.name ? `${error.name}: ` : ""}{error?.message || "Erreur inconnue"}
{error?.digest ? `\n[digest ${error.digest}]` : ""}
        </pre>
        <div className="flex gap-2 mt-3">
          <button
            onClick={reset}
            className="px-3 py-2 bg-canal-yellow text-canal-black font-black rounded-lg text-sm"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="px-3 py-2 bg-canal-gray-mid text-canal-gray-muted border border-canal-gray-light rounded-lg text-sm"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}
