"use client";

import { useEffect, useState } from "react";

type Platform = "ios" | "android" | "other" | null;

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua);
    const android = /Android/.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;

    setPlatform(ios ? "ios" : android ? "android" : "other");
    setIsInstalled(standalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    setInstalling(true);
    await installPrompt.prompt();
    setInstalling(false);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 bg-canal-black text-center">
        <img src="/icons/icon-192.png" alt="Canal Cup" className="w-20 h-20 rounded-2xl" />
        <div>
          <p className="text-canal-yellow font-black text-2xl">Déjà installé !</p>
          <p className="text-canal-gray-muted text-sm mt-1">Canal Cup est sur votre écran d&apos;accueil.</p>
        </div>
        <a href="/" className="px-8 py-3 bg-canal-yellow text-black font-black rounded-2xl text-base">
          Ouvrir Canal Cup →
        </a>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start gap-0 bg-canal-black">
      {/* Hero */}
      <div className="w-full flex flex-col items-center gap-4 pt-12 pb-8 px-6">
        <img
          src="/icons/icon-192.png"
          alt="Canal Cup"
          className="w-24 h-24 rounded-3xl shadow-2xl shadow-canal-yellow/20"
        />
        <div className="text-center">
          <p className="text-canal-yellow font-black text-3xl tracking-tight">CANAL CUP</p>
          <p className="text-white/40 text-sm">Coupe du Monde 2026 · Canal+</p>
        </div>
      </div>

      <div className="w-full max-w-sm px-4 pb-12 space-y-4">

        {/* Bouton install automatique Android si disponible */}
        {installPrompt && (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="w-full py-4 bg-canal-yellow text-black font-black text-lg rounded-2xl shadow-lg shadow-canal-yellow/20 disabled:opacity-50"
          >
            {installing ? "Installation…" : "📲 Installer Canal Cup"}
          </button>
        )}

        {/* Guide iOS */}
        {platform === "ios" && (
          <div className="bg-canal-gray border border-canal-gray-light rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-canal-gray-light">
              <p className="font-black text-white text-sm">Installer sur iPhone / iPad</p>
              <p className="text-canal-gray-muted text-xs mt-0.5">Via Safari uniquement</p>
            </div>
            <div className="p-4 space-y-4">
              {[
                { n: "1", icon: "⬆️", text: <>Appuyez sur <strong className="text-white">Partager</strong> (icône en bas de Safari)</> },
                { n: "2", icon: "📋", text: <>Faites défiler et appuyez sur <strong className="text-white">Sur l&apos;écran d&apos;accueil</strong></> },
                { n: "3", icon: "✅", text: <>Appuyez sur <strong className="text-white">Ajouter</strong> en haut à droite</> },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-canal-yellow text-black text-xs font-black flex items-center justify-center">
                    {step.n}
                  </span>
                  <p className="text-canal-gray-muted text-sm leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guide Android Chrome (sans prompt auto) */}
        {platform === "android" && !installPrompt && (
          <div className="bg-canal-gray border border-canal-gray-light rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-canal-gray-light">
              <p className="font-black text-white text-sm">Installer sur Android</p>
              <p className="text-canal-gray-muted text-xs mt-0.5">Via Chrome</p>
            </div>
            <div className="p-4 space-y-4">
              {[
                { n: "1", text: <>Appuyez sur <strong className="text-white">⋮</strong> (menu en haut à droite)</> },
                { n: "2", text: <>Appuyez sur <strong className="text-white">Ajouter à l&apos;écran d&apos;accueil</strong></> },
                { n: "3", text: <>Confirmez en appuyant sur <strong className="text-white">Ajouter</strong></> },
              ].map(step => (
                <div key={step.n} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-canal-yellow text-black text-xs font-black flex items-center justify-center">
                    {step.n}
                  </span>
                  <p className="text-canal-gray-muted text-sm leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guide autre (desktop/navigateur inconnu) */}
        {platform === "other" && !installPrompt && (
          <div className="bg-canal-gray border border-canal-gray-light rounded-2xl p-4">
            <p className="text-canal-gray-muted text-sm text-center">
              Ouvrez cette page sur votre téléphone pour installer Canal Cup.
            </p>
          </div>
        )}

        {/* CTA connexion */}
        <div className="bg-canal-gray-mid border border-canal-gray-light rounded-2xl p-4 text-center space-y-3">
          <p className="text-white/60 text-xs">Après installation, connectez-vous avec votre adresse Canal+</p>
          <a
            href="/"
            className="inline-block px-6 py-2.5 bg-white/10 text-white text-sm font-bold rounded-xl border border-white/10"
          >
            Accéder à Canal Cup →
          </a>
        </div>

      </div>
    </div>
  );
}
