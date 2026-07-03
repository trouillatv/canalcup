import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingFeedback } from "@/components/feedback/FloatingFeedback";
import { BreakingNews } from "@/components/matches/BreakingNews";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PushNotifications } from "@/components/pwa/PushNotifications";
import { AppBadge } from "@/components/pwa/AppBadge";
import { TimezoneProvider } from "@/components/timezone/TimezoneProvider";
import { EventSplash } from "@/components/events/EventSplash";
import { PageTracker } from "@/components/analytics/PageTracker";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_TZ, normalizeTimezone } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Canal Cup 2026",
  description: "Le tournoi interne Canal+ autour de la Coupe du Monde",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Canal Cup",
    startupImage: "/icons/apple-touch-icon.png",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
    icon: "/icons/icon-192.png",
  },
  openGraph: {
    title: "Canal Cup 2026",
    description: "Pronostics, équipes, classement et bonne ambiance",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0D0B08",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthenticated = !!user;

  // Fuseau de l'utilisateur → alimente le contexte d'affichage des heures.
  // Repli sur NC (lieu de l'événement) si non connecté ou champ absent.
  let tz: string = DEFAULT_TZ;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("timezone")
      .eq("auth_id", user.id)
      .maybeSingle();
    tz = normalizeTimezone(profile?.timezone);
  }

  return (
    <html lang="fr" className="dark">
      <head>
        {/* Capture beforeinstallprompt avant que React monte */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__deferredInstallPrompt = null;
          window.addEventListener('beforeinstallprompt', function(e) {
            e.preventDefault();
            window.__deferredInstallPrompt = e;
          });
        `}} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-canal-black text-white antialiased" suppressHydrationWarning>
        <TimezoneProvider tz={tz}>
          {isAuthenticated && <TopBar />}
          <main className={isAuthenticated ? "min-h-screen pt-safe-topbar safe-bottom" : "min-h-screen"}>
            {/* Flash info / direct — visible sur TOUTES les pages, masqué tout seul
                s'il n'y a ni live ni flash (le composant renvoie null). */}
            {isAuthenticated && <BreakingNews />}
            {children}
          </main>
          {isAuthenticated && <BottomNav />}
          {isAuthenticated && <FloatingFeedback />}
          {/* 🎆 Annonce événementielle (prochain Quiz) au lancement de l'app. */}
          {isAuthenticated && <EventSplash />}
          <PwaSetup />
          <InstallPrompt />
          {isAuthenticated && <PushNotifications />}
          {isAuthenticated && <AppBadge />}
          {isAuthenticated && <PageTracker />}
        </TimezoneProvider>
      </body>
    </html>
  );
}
