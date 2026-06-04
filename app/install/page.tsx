"use client";

import { useEffect, useState } from "react";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

const STEPS = [
  {
    n: "1",
    title: "Connectez-vous",
    desc: "Accédez à Canal Cup avec votre adresse Canal+",
    action: { label: "Se connecter", href: "/" },
  },
  {
    n: "2",
    title: "Installez l'app",
    desc: "Ajoutez Canal Cup à votre écran d'accueil — aucun store requis",
    action: null,
  },
  {
    n: "3",
    title: "Faites votre premier prono",
    desc: "Pronostiquez le match, rejoignez le quiz, grimpez au classement",
    action: null,
  },
];

export default function InstallPage() {
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    setIsInstalled(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 p-6 bg-canal-black">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3">
        <img
          src="/icons/icon-192.png"
          alt="Canal Cup"
          className="w-24 h-24 rounded-3xl shadow-2xl shadow-canal-yellow/20"
        />
        <div className="text-center">
          <p className="text-canal-yellow font-black text-3xl tracking-tight">CANAL CUP</p>
          <p className="text-white/40 text-sm font-medium">Coupe du Monde 2026</p>
        </div>
      </div>

      {/* Steps */}
      <div className="w-full max-w-sm space-y-3">
        {STEPS.map((step) => (
          <div
            key={step.n}
            className="bg-canal-gray border border-canal-gray-light rounded-2xl p-4 flex items-start gap-4"
          >
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-canal-yellow text-black text-sm font-black flex items-center justify-center">
              {step.n}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{step.title}</p>
              <p className="text-canal-gray-muted text-xs mt-0.5 leading-relaxed">{step.desc}</p>
              {step.action && (
                <a
                  href={step.action.href}
                  className="inline-block mt-2 px-4 py-1.5 bg-canal-yellow text-black text-xs font-bold rounded-lg"
                >
                  {step.action.label}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {isInstalled ? (
        <a
          href="/"
          className="px-8 py-3 bg-canal-yellow text-black font-black rounded-2xl text-base shadow-lg shadow-canal-yellow/20"
        >
          Ouvrir Canal Cup →
        </a>
      ) : (
        <p className="text-canal-gray-muted text-xs text-center max-w-xs">
          Le bandeau d&apos;installation apparaîtra après connexion.
          <br />Sur iPhone : Partager → Sur l&apos;écran d&apos;accueil.
        </p>
      )}

      {/* Floating install prompt (handles Android beforeinstallprompt) */}
      <InstallPrompt />
    </div>
  );
}
