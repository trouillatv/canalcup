import { CalendarDays, CircleUserRound, Home, Target, Trophy } from "lucide-react";
import type { FeatureKey } from "@/lib/features/flags";

export const CANAL_SPORTS_NAV_ITEMS: {
  href: string;
  icon: typeof Home;
  label: string;
  feature?: FeatureKey;
}[] = [
  { href: "/cs", icon: Home, label: "Accueil" },
  { href: "/cs/programme", icon: CalendarDays, label: "Programme", feature: "program" },
  { href: "/cs/pronostics", icon: Target, label: "Pronostics", feature: "predictions" },
  { href: "/cs/classements", icon: Trophy, label: "Classements", feature: "rankings" },
  { href: "/profile", icon: CircleUserRound, label: "Profil" },
];
