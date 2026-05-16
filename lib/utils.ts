import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const NC_TIMEZONE = "Pacific/Noumea";

export function toNCTime(date: string | Date): string {
  return formatInTimeZone(new Date(date), NC_TIMEZONE, "HH:mm", { locale: fr });
}

export function toNCDate(date: string | Date): string {
  return formatInTimeZone(new Date(date), NC_TIMEZONE, "EEEE d MMMM", {
    locale: fr,
  });
}

export function toNCDateShort(date: string | Date): string {
  return formatInTimeZone(new Date(date), NC_TIMEZONE, "d MMM", { locale: fr });
}

export function isToday(date: string | Date): boolean {
  const d = formatInTimeZone(new Date(date), NC_TIMEZONE, "yyyy-MM-dd");
  const today = formatInTimeZone(new Date(), NC_TIMEZONE, "yyyy-MM-dd");
  return d === today;
}

export function flagEmoji(countryCode: string): string {
  const flags: Record<string, string> = {
    FR: "🇫🇷", BR: "🇧🇷", AR: "🇦🇷", DE: "🇩🇪", ES: "🇪🇸",
    PT: "🇵🇹", GB: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", IT: "🇮🇹", NL: "🇳🇱", BE: "🇧🇪",
    HR: "🇭🇷", MA: "🇲🇦", SN: "🇸🇳", JP: "🇯🇵", KR: "🇰🇷",
    US: "🇺🇸", MX: "🇲🇽", CO: "🇨🇴", UY: "🇺🇾", EC: "🇪🇨",
    CH: "🇨🇭", DK: "🇩🇰", PL: "🇵🇱", AU: "🇦🇺", NG: "🇳🇬",
    GH: "🇬🇭", CM: "🇨🇲", TN: "🇹🇳",
  };
  return flags[countryCode.toUpperCase()] ?? "🏳️";
}

export function pointsBadge(points: number): string {
  if (points >= 150) return "🥇";
  if (points >= 100) return "🥈";
  if (points >= 50) return "🥉";
  return "💪";
}
