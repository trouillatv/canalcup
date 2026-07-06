// /programme — page d'annonce du PROGRAMME CanalCup pendant la Coupe du Monde.
// Pensée « organisateur d'événement » : CanalCup accompagne la CdM (il ne la
// concurrence pas). On annonce les grands rendez-vous (quiz, baby-foot, remise
// des prix), avec le « pourquoi » de chaque date, la cérémonie de clôture et le
// petit rituel quotidien. Contenu éditorial statique (pas de données live).

import Link from "next/link";
import { headers } from "next/headers";
import {
  CalendarDays, Target, Brain, Gamepad2, Trophy, Star,
  Sparkles, Clock, ArrowLeft, Users, ScanLine, ChevronRight,
} from "lucide-react";

export const metadata = {
  title: "Programme CanalCup",
  description: "Le calendrier des animations CanalCup pendant la Coupe du Monde 2026.",
};

// URL absolue de l'app (pour encoder le QR). NEXT_PUBLIC_APP_URL si défini,
// sinon reconstruite depuis les en-têtes de la requête.
async function appBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : "";
}

type EventItem = {
  date: string;
  time?: string;
  title: string;
  why: string;
  icon: typeof Brain;
  accent?: "star" | "trophy";
};

const EVENTS: EventItem[] = [
  { date: "Mer 1 juil.", title: "Ouverture des pronostics des 16es", why: "Les gens reviennent des poules", icon: Target },
  { date: "Ven 3 juil.", time: "midi", title: "Grand Quiz #1", why: "Tout le monde a les matchs en tête", icon: Brain, accent: "star" },
  { date: "Jeu 9 juil.", time: "midi", title: "Baby-foot", why: "Entre les huitièmes et les quarts", icon: Gamepad2 },
  { date: "Lun 13 juil.", time: "midi", title: "Grand Quiz #2 — qualif", why: "Dernière manche de qualification avant la finale", icon: Brain, accent: "star" },
  { date: "Jeu 16 / Ven 17 juil.", title: "Finale Baby-foot & animations", why: "La finale approche", icon: Gamepad2 },
  { date: "Ven 17 juil.", time: "midi", title: "Grande Finale Quiz", why: "Les 5 meilleurs du championnat Quiz s'affrontent en direct", icon: Brain, accent: "star" },
  { date: "Lun 20 juil.", title: "Remise des prix CanalCup", why: "Clôture de l'événement", icon: Trophy, accent: "trophy" },
];

const AWARDS: { emoji: string; label: string }[] = [
  { emoji: "🥇", label: "Champion CanalCup" },
  { emoji: "🎯", label: "Meilleur pronostiqueur" },
  { emoji: "🧠", label: "Roi des quiz" },
  { emoji: "⚽", label: "Meilleur baby-foot" },
  { emoji: "🎭", label: "Prix VAR (déguisement)" },
  { emoji: "😂", label: "Plus belle photo" },
  { emoji: "🤖", label: "Citation Robert de la CdM" },
  { emoji: "📸", label: "Plus beau moment CanalCup" },
];

export default async function ProgrammePage() {
  const base = await appBaseUrl();
  // Le QR amène les nouveaux sur l'app (inscription via magic link), d'où ils
  // pourront former leur binôme.
  const joinUrl = base ? `${base}/` : "";
  const qrUrl = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=12&data=${encodeURIComponent(joinUrl)}`
    : "";

  return (
    <div className="px-4 py-4 space-y-7 max-w-2xl mx-auto pb-24">
      {/* Header */}
      <header className="space-y-2">
        <Link href="/animations" className="inline-flex items-center gap-1 text-canal-gray-muted hover:text-white text-sm">
          <ArrowLeft size={14} /> Animations
        </Link>
        <h1 className="canal-headline text-2xl flex items-center gap-2">
          <CalendarDays className="text-canal-yellow" size={24} /> Le programme
        </h1>
        <p className="text-canal-gray-muted text-sm leading-relaxed">
          CanalCup <span className="text-white font-semibold">accompagne</span> la Coupe du Monde —
          il ne la concurrence pas. Quelques rendez-vous bien placés pour faire vivre l&apos;ambiance,
          sans monopoliser le temps de travail.
        </p>
      </header>

      {/* Rejoindre CanalCup : QR (inscription) + lien binôme */}
      <section className="rounded-2xl border border-canal-gray-light bg-canal-gray p-4">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider flex items-center gap-2 mb-3">
          <ScanLine size={15} /> Rejoindre & faire son binôme
        </h2>
        <div className="flex items-center gap-4">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="QR code d'inscription CanalCup"
              width={120}
              height={120}
              className="w-28 h-28 rounded-xl bg-white p-1.5 shrink-0"
            />
          ) : (
            <div className="w-28 h-28 rounded-xl bg-canal-gray-mid flex items-center justify-center shrink-0">
              <ScanLine size={28} className="text-canal-gray-muted" />
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-white font-bold text-sm leading-snug">
              Scanne pour t&apos;inscrire, puis forme ton binôme.
            </p>
            <p className="text-canal-gray-muted text-xs leading-relaxed">
              Chacun joue en duo : pronostics, quiz et animations comptent pour votre binôme.
            </p>
            <Link
              href="/binomes"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-canal-yellow text-canal-black font-black text-sm hover:bg-canal-yellow-hover transition-colors"
            >
              <Users size={15} /> Trouver mon binôme
              <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </section>

      {/* À la une : Grand Quiz #2 */}
      <section className="rounded-2xl border border-canal-yellow/40 bg-gradient-to-b from-canal-yellow/10 to-transparent p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="canal-badge">À la une</span>
          <span className="text-canal-yellow font-black text-lg flex items-center gap-1.5">
            <Star size={18} className="fill-canal-yellow" /> Grand Quiz #2 — qualif
          </span>
        </div>
        <p className="text-white font-bold text-xl">Lundi 13 juillet · 12h00</p>
        <p className="text-canal-gray-muted text-sm">Le premier quiz a cartonné — on remet ça ! Dernière manche pour se qualifier :</p>
        <ul className="text-sm text-white/90 space-y-1.5">
          <li className="flex gap-2"><span className="text-canal-yellow">•</span> 2e (et dernière) phase de qualification ;</li>
          <li className="flex gap-2"><span className="text-canal-yellow">•</span> de nouvelles questions (pas celles du Quiz #1) ;</li>
          <li className="flex gap-2"><span className="text-canal-yellow">•</span> les points s&apos;ajoutent au championnat cumulé ;</li>
          <li className="flex gap-2"><span className="text-canal-yellow">•</span> les <b className="text-white">5 meilleurs</b> filent en Grande Finale le 17.</li>
        </ul>
        <p className="text-white/70 text-sm italic">La Grande Finale se joue le vendredi 17 juillet à midi.</p>
      </section>

      {/* Calendrier idéal — timeline */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">🗓️ Le calendrier idéal</h2>
        <div className="space-y-2.5">
          {EVENTS.map((e, i) => {
            const Icon = e.icon;
            const star = e.accent === "star";
            const trophy = e.accent === "trophy";
            return (
              <div
                key={i}
                className={`canal-card flex items-start gap-3 ${
                  star ? "border-canal-yellow/40" : trophy ? "border-canal-yellow/30" : ""
                }`}
              >
                <div
                  className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                    star || trophy ? "bg-canal-yellow text-canal-black" : "bg-canal-gray-mid text-canal-yellow"
                  }`}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-canal-yellow font-black text-sm">{e.date}</span>
                    {e.time && <span className="text-white/50 text-xs">· {e.time}</span>}
                  </div>
                  <p className="text-white font-bold leading-snug">
                    {trophy && "🏆 "}
                    {e.title}
                  </p>
                  <p className="text-canal-gray-muted text-xs mt-0.5">{e.why}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cérémonie de clôture */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider">🏆 La remise des prix</h2>
        <p className="text-canal-gray-muted text-sm leading-relaxed">
          Le meilleur moment de l&apos;app, c&apos;est <span className="text-white">après la finale</span>.
          Pas juste « Vincent gagne CanalCup » : un vrai petit cérémonial de 10 minutes, dont on se souviendra.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {AWARDS.map((a) => (
            <div key={a.label} className="canal-card flex items-center gap-2.5 py-3">
              <span className="text-2xl shrink-0">{a.emoji}</span>
              <span className="text-white font-semibold text-sm leading-tight">{a.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Rituel quotidien */}
      <section className="rounded-2xl border border-canal-gray-light bg-canal-gray p-4 space-y-3">
        <h2 className="text-sm font-bold text-canal-yellow uppercase tracking-wider flex items-center gap-2">
          <Sparkles size={15} /> Le rituel du matin
        </h2>
        <p className="text-canal-gray-muted text-sm leading-relaxed">
          Les lendemains de gros match, à <span className="text-white font-semibold">8h30</span>, la TV du
          salon affiche automatiquement un mini-rendez-vous de 2 minutes :
        </p>
        <ul className="text-sm text-white/90 space-y-1.5">
          <li className="flex gap-2"><span>⚽</span> les résultats de la veille ;</li>
          <li className="flex gap-2"><span>📈</span> les évolutions du classement CanalCup ;</li>
          <li className="flex gap-2"><span>🤖</span> une phrase humoristique de Robert ;</li>
          <li className="flex gap-2"><Clock size={16} className="text-canal-yellow shrink-0" /> « Aujourd&apos;hui, 12h00 : Quiz » ou « Aujourd&apos;hui : Baby-foot ».</li>
        </ul>
        <p className="text-white/70 text-sm italic">
          Un rendez-vous quotidien très léger qui donne l&apos;impression que CanalCup « vit » pendant toute la compétition.
        </p>
      </section>

      <p className="text-center text-canal-gray-muted text-xs pt-2">
        Horaires en heure de Nouvelle-Calédonie 🇳🇨
      </p>
    </div>
  );
}
