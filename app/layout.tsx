import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";

export const metadata: Metadata = {
  title: "Canal Cup 2026",
  description: "Le tournoi interne Canal+ autour de la Coupe du Monde",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Canal Cup",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="dark">
      <head>
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
      <body className="bg-canal-black text-white antialiased">
        <TopBar />
        <main className="min-h-screen pt-14 safe-bottom">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
