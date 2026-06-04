import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNav } from "@/components/layout/BottomNav";
import { FloatingFeedback } from "@/components/feedback/FloatingFeedback";
import { BreakingNews } from "@/components/matches/BreakingNews";
import { PwaSetup } from "@/components/pwa/PwaSetup";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { PushNotifications } from "@/components/pwa/PushNotifications";
import { createClient } from "@/lib/supabase/server";

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
        {isAuthenticated && <TopBar />}
        <main className={isAuthenticated ? "min-h-screen pt-14 safe-bottom" : "min-h-screen"}>
          {/* Flash info / direct — visible sur TOUTES les pages, masqué tout seul
              s'il n'y a ni live ni flash (le composant renvoie null). */}
          {isAuthenticated && <BreakingNews />}
          {children}
        </main>
        {isAuthenticated && <BottomNav />}
        {isAuthenticated && <FloatingFeedback />}
        <PwaSetup />
        <InstallPrompt />
        {isAuthenticated && <PushNotifications />}
      </body>
    </html>
  );
}
