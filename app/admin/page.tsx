"use client";

// /admin — dashboard admin centralisé. Widget en évidence : compteur
// QR code WC2026 (scans uniques + vues totales, refresh 5s). En
// dessous : grille des outils admin (quiz, challenges, babyfoot,
// users, qr, etc.).

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  QrCode, Trophy, PartyPopper, Gamepad2, Users,
  Shield, RefreshCw, ArrowRight, Activity, SearchCheck, Image as ImageIcon, MessageSquare,
  ClipboardList, Bell, Sparkles,
} from "lucide-react";

interface QrCounter {
  slug: string;
  count: number;
  unique_count: number;
  last_scan_at: string | null;
}

const TOOLS: Array<{
  href: string;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent?: boolean;
}> = [
  { href: "/admin/monitoring",      label: "Monitoring IA",   desc: "Santé API, quotas, crons, scraping. À vérifier la veille de l'événement.", icon: Activity, accent: true },
  { href: "/admin/predictions-monitor", label: "Suivi pronos", desc: "Voir qui a pronostiqué, qui manque, et la synthèse match par match.", icon: ClipboardList },
  { href: "/admin/notifications",   label: "Notifications push", desc: "État VAPID, abonnés par plateforme, test d'envoi et purge des abonnements morts.", icon: Bell },
  { href: "/admin/quiz",            label: "Quiz",            desc: "Gérer les questions, lancer le Live Show, voir les résultats.", icon: Trophy },
  { href: "/admin/challenges",      label: "Animations",      desc: "Créer/modérer les challenges, attribuer les points.",           icon: PartyPopper },
  { href: "/admin/babyfoot",        label: "Babyfoot — matchs", desc: "Saisir les matchs et résultats babyfoot.",                    icon: Gamepad2 },
  { href: "/admin/babyfoot/teams",  label: "Babyfoot — équipes", desc: "Composer les équipes babyfoot.",                              icon: Gamepad2 },
  { href: "/admin/users",           label: "Utilisateurs",    desc: "Allowlist, rôles, désactivation, envoi de magic links.",        icon: Users },
  { href: "/admin/user-audit",      label: "Monitoring Users", desc: "Qui est actif, bloqué, qui participe. Sécurité + support + animation.", icon: SearchCheck },
  { href: "/admin/feedback",         label: "Feedback",         desc: "Les retours envoyés par les testeurs via la bulle « Un souci ? ».", icon: MessageSquare },
  { href: "/admin/qr",              label: "QR Code WC2026",  desc: "Imprimer / partager le QR + voir les scans.",                   icon: QrCode },
  { href: "/admin/jokers",          label: "Jokers",          desc: "Attribuer/retirer des jokers, voir effets actifs, cibles et cartons.", icon: Sparkles },
];

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function AdminHomePage() {
  const [qr, setQr] = useState<QrCounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : ""));
  }, []);

  // Image du QR (même service que /admin/qr) → pointe vers /p/welcome.
  const qrImageUrl = origin
    ? `https://api.qrserver.com/v1/create-qr-code/?size=600x600&margin=20&data=${encodeURIComponent(`${origin}/p/welcome`)}`
    : "";

  const fetchQr = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/qr?slug=welcome", { credentials: "same-origin" });
      if (res.ok) setQr(await res.json());
    } catch { /* silencieux */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQr();
    const t = setInterval(fetchQr, 5000);
    return () => clearInterval(t);
  }, [fetchQr]);

  return (
    <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="canal-headline text-2xl flex items-center gap-2">
            <Shield size={22} /> Dashboard admin
          </h1>
          <p className="text-canal-gray-muted text-sm mt-1">
            Centre de contrôle Canal Cup — pilotage en temps réel.
          </p>
        </div>
      </div>

      {/* ─── Widget QR Code — en évidence ─── */}
      <section className="canal-card border border-canal-yellow/30 bg-gradient-to-br from-canal-yellow/5 to-transparent space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-canal-yellow" />
            <h2 className="font-bold text-white text-base">QR Code WC2026 — Affiche calendrier</h2>
          </div>
          <button
            onClick={fetchQr}
            className="text-xs text-canal-gray-muted hover:text-white flex items-center gap-1"
            title="Rafraîchir maintenant"
          >
            <RefreshCw size={11} /> Rafraîchir
          </button>
        </div>

        {loading && !qr ? (
          <p className="text-canal-gray-muted text-sm">Chargement…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-yellow/40">
              <p className="text-[10px] uppercase tracking-wider text-canal-yellow font-bold">
                Scans uniques
              </p>
              <p className="text-canal-yellow font-black text-4xl tabular-nums leading-tight mt-1">
                {qr?.unique_count ?? 0}
              </p>
              <p className="text-[10px] text-canal-gray-muted mt-0.5">
                appareils distincts (30j)
              </p>
            </div>
            <div className="bg-canal-gray-mid rounded-xl px-3 py-3 border border-canal-gray-light">
              <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">
                Vues totales
              </p>
              <p className="text-white font-black text-4xl tabular-nums leading-tight mt-1">
                {qr?.count ?? 0}
              </p>
              <p className="text-[10px] text-canal-gray-muted mt-0.5">
                refresh inclus
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <p className="text-canal-gray-muted">
            Dernier scan : <span className="text-white">{formatTime(qr?.last_scan_at ?? null)}</span>
          </p>
          <Link
            href="/admin/qr"
            className="text-canal-yellow font-bold flex items-center gap-1 hover:underline"
          >
            Voir / partager le QR <ArrowRight size={11} />
          </Link>
        </div>

        {/* Lien direct vers l'image du QR (ouvre le PNG dans un nouvel onglet) */}
        {qrImageUrl && (
          <a
            href={qrImageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-canal-gray-muted hover:text-white transition-colors"
          >
            <ImageIcon size={12} /> Ouvrir l&apos;image du QR
          </a>
        )}
      </section>

      {/* ─── Grille outils admin ─── */}
      <section className="space-y-2">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">
          Outils admin
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {TOOLS.map(({ href, label, desc, icon: Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className={`canal-card hover:border-canal-yellow/40 transition-colors group ${
                accent ? "border border-canal-yellow/30" : ""
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-canal-yellow/15 text-canal-yellow flex items-center justify-center shrink-0">
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-white text-sm">{label}</p>
                    <ArrowRight size={12} className="text-canal-gray-muted group-hover:text-canal-yellow shrink-0" />
                  </div>
                  <p className="text-canal-gray-muted text-[11px] mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
