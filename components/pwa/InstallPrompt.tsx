"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __deferredInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android" | null>(null);
  const [isInstalled, setIsInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) && !(window as { MSStream?: unknown }).MSStream;
    const android = /Android/.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    // v2 : nouvelle clé pour éviter que l'ancien dismissed bloque le nouveau banner
    const wasDismissed = localStorage.getItem("pwa-install-v2") === "dismissed";
    // Paramètre ?reset-pwa=1 pour forcer le réaffichage (debug / démo)
    if (new URLSearchParams(window.location.search).get("reset-pwa") === "1") {
      localStorage.removeItem("pwa-install-v2");
    }

    setPlatform(ios ? "ios" : android ? "android" : null);
    setIsInstalled(standalone);
    setDismissed(wasDismissed);

    // Récupérer l'event capturé globalement (avant montage React)
    if (window.__deferredInstallPrompt) {
      setInstallPrompt(window.__deferredInstallPrompt);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      const prompt = e as BeforeInstallPromptEvent;
      window.__deferredInstallPrompt = prompt;
      setInstallPrompt(prompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (platform === "ios") {
      setShowGuide(true);
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === "accepted") {
        setInstallPrompt(null);
        setDismissed(true);
      }
    } else {
      // Fallback : guide manuel Chrome
      setShowGuide(true);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-v2", "dismissed");
    setDismissed(true);
    setShowGuide(false);
  };

  // Masquer si : déjà installé, déjà refusé, ou pas mobile
  if (isInstalled || dismissed || !platform) return null;

  const iosSteps = [
    <>Appuyez sur <strong className="text-white">Partager</strong> <span className="text-canal-gray-muted">(icône ⬆️ en bas de Safari)</span></>,
    <>Faites défiler et appuyez sur <strong className="text-white">Sur l&apos;écran d&apos;accueil</strong></>,
    <>Appuyez sur <strong className="text-white">Ajouter</strong></>,
  ];

  const androidSteps = [
    <>Appuyez sur <strong className="text-white">⋮</strong> (menu en haut à droite de Chrome)</>,
    <>Appuyez sur <strong className="text-white">Ajouter à l&apos;écran d&apos;accueil</strong></>,
    <>Confirmez en appuyant sur <strong className="text-white">Ajouter</strong></>,
  ];

  const guideSteps = platform === "ios" ? iosSteps : androidSteps;
  const guideTitle = platform === "ios" ? "Installer sur iPhone" : "Installer sur Android";

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-canal-gray border border-canal-gray-light rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
          <img src="/icons/icon-192.png" alt="Canal Cup" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Installer Canal Cup</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">Accès rapide depuis votre écran d&apos;accueil</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-canal-yellow text-black text-xs font-bold rounded-lg"
            >
              Installer
            </button>
            <button onClick={handleDismiss} className="p-1 text-canal-gray-muted hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowGuide(false)}
        >
          <div className="w-full bg-canal-gray border-t border-canal-gray-light rounded-t-3xl p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{guideTitle}</h3>
              <button onClick={() => setShowGuide(false)} className="p-1 text-canal-gray-muted hover:text-white">
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-4">
              {guideSteps.map((step, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-canal-yellow text-black text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-canal-gray-muted">{step}</span>
                </li>
              ))}
            </ol>
            <button
              onClick={handleDismiss}
              className="w-full py-3 text-sm text-canal-gray-muted border border-canal-gray-light rounded-xl"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}
