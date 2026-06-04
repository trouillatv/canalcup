"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(true);
  const [dismissed, setDismissed] = useState(true);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const wasDismissed = localStorage.getItem("pwa-install-dismissed") === "true";

    setIsIOS(ios);
    setIsInstalled(standalone);
    setDismissed(wasDismissed);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "true");
    setDismissed(true);
    setShowIOSGuide(false);
  };

  if (isInstalled || dismissed) return null;
  if (!installPrompt && !isIOS) return null;

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 z-50 animate-slide-up">
        <div className="bg-canal-gray border border-canal-gray-light rounded-2xl p-4 flex items-center gap-3 shadow-2xl">
          <img
            src="/icons/icon-192.png"
            alt="Canal Cup"
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Installer Canal Cup</p>
            <p className="text-xs text-canal-gray-muted mt-0.5">
              Accès rapide depuis votre écran d&apos;accueil
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="px-3 py-1.5 bg-canal-yellow text-black text-xs font-bold rounded-lg"
            >
              Installer
            </button>
            <button
              onClick={handleDismiss}
              className="p-1 text-canal-gray-muted hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>

      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-end animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowIOSGuide(false)}
        >
          <div className="w-full bg-canal-gray border-t border-canal-gray-light rounded-t-3xl p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Installer sur iPhone</h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-canal-gray-muted hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
            <ol className="space-y-4">
              {[
                <>Appuyez sur <strong className="text-white">Partager</strong> <span className="text-canal-gray-muted">(icône en bas de Safari)</span></>,
                <>Faites défiler et appuyez sur <strong className="text-white">Sur l&apos;écran d&apos;accueil</strong></>,
                <>Appuyez sur <strong className="text-white">Ajouter</strong></>,
              ].map((step, i) => (
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
