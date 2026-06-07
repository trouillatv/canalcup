import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { fr } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fuseau par défaut = lieu de l'événement (NC). Sert de repli quand on
// n'a pas la préférence d'un utilisateur (écrans TV, crons, non connecté).
export const DEFAULT_TZ = "Pacific/Noumea";

// Les 3 territoires Canal+ supportés. NC et Vanuatu sont tous deux en
// UTC+11 (zones distinctes mais même offset, aucun n'a d'heure d'été) ;
// Tahiti est en UTC-10 — 21 h d'écart avec les deux autres.
export const TZ_OPTIONS = [
  { tz: "Pacific/Noumea", label: "NC", region: "Nouvelle-Calédonie", flag: "🇳🇨" },
  { tz: "Pacific/Efate", label: "Vanuatu", region: "Vanuatu", flag: "🇻🇺" },
  { tz: "Pacific/Tahiti", label: "Tahiti", region: "Polynésie française", flag: "🇵🇫" },
] as const;

export type SupportedTz = (typeof TZ_OPTIONS)[number]["tz"];

// Libellé court à coller après une heure (« 18:00 NC »).
export function tzLabel(tz: string | null | undefined): string {
  return TZ_OPTIONS.find((o) => o.tz === tz)?.label ?? "NC";
}

// Ramène n'importe quelle valeur à l'une de nos 3 zones (défaut NC).
// Tolère les alias de fuseau que certains navigateurs renvoient, et à
// défaut se rabat sur l'offset UTC courant (fixe pour ces territoires).
export function normalizeTimezone(tz: string | null | undefined): SupportedTz {
  if (tz && TZ_OPTIONS.some((o) => o.tz === tz)) return tz as SupportedTz;
  switch (tz) {
    case "Pacific/Port_Vila":
      return "Pacific/Efate";
    case "Pacific/Marquesas": // Marquises (UTC-9:30) → rattaché à la Polynésie
      return "Pacific/Tahiti";
    default:
      return DEFAULT_TZ;
  }
}

// Détection navigateur (client only) → l'une de nos 3 zones.
export function detectTimezone(): SupportedTz {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const direct = normalizeTimezone(zone);
    if (direct !== DEFAULT_TZ || zone === DEFAULT_TZ) return direct;
    // Repli par offset (minutes à l'est de UTC). Tahiti = -600, NC/Vanuatu = +660.
    const offset = -new Date().getTimezoneOffset();
    if (offset <= -570) return "Pacific/Tahiti"; // -9:30 (Marquises) et au-delà
    if (offset === 660) return "Pacific/Noumea";
  } catch {
    /* SSR ou Intl indisponible */
  }
  return DEFAULT_TZ;
}

export function toNCTime(date: string | Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(date), tz, "HH:mm", { locale: fr });
}

export function toNCDate(date: string | Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(date), tz, "EEEE d MMMM", {
    locale: fr,
  });
}

export function toNCDateShort(date: string | Date, tz: string = DEFAULT_TZ): string {
  return formatInTimeZone(new Date(date), tz, "d MMM", { locale: fr });
}

export function isToday(date: string | Date, tz: string = DEFAULT_TZ): boolean {
  const d = formatInTimeZone(new Date(date), tz, "yyyy-MM-dd");
  const today = formatInTimeZone(new Date(), tz, "yyyy-MM-dd");
  return d === today;
}

// Self-contained flag map (English + French names) — no external imports to avoid hydration mismatches
const TEAM_FLAGS: Record<string, string> = {
  // English names
  USA: "🇺🇸", "United States": "🇺🇸", Canada: "🇨🇦", Mexico: "🇲🇽",
  Brazil: "🇧🇷", Argentina: "🇦🇷", Uruguay: "🇺🇾", Colombia: "🇨🇴",
  Ecuador: "🇪🇨", Paraguay: "🇵🇾", Peru: "🇵🇪", Chile: "🇨🇱",
  Venezuela: "🇻🇪", Bolivia: "🇧🇴", Jamaica: "🇯🇲", Haiti: "🇭🇹",
  Panama: "🇵🇦", "Costa Rica": "🇨🇷", Honduras: "🇭🇳", "El Salvador": "🇸🇻",
  "Trinidad and Tobago": "🇹🇹", Cuba: "🇨🇺", "Curaçao": "🇨🇼",
  France: "🇫🇷", Spain: "🇪🇸", Germany: "🇩🇪", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Portugal: "🇵🇹", Netherlands: "🇳🇱", Belgium: "🇧🇪", Italy: "🇮🇹",
  Switzerland: "🇨🇭", Croatia: "🇭🇷", Denmark: "🇩🇰", Sweden: "🇸🇪",
  Norway: "🇳🇴", Poland: "🇵🇱", Serbia: "🇷🇸", Ukraine: "🇺🇦",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Czech Republic": "🇨🇿",
  Slovakia: "🇸🇰", Hungary: "🇭🇺", Romania: "🇷🇴", Austria: "🇦🇹",
  "Bosnia-Herzegovina": "🇧🇦", Slovenia: "🇸🇮", Albania: "🇦🇱",
  Greece: "🇬🇷", Turkey: "🇹🇷", Georgia: "🇬🇪", Iceland: "🇮🇸",
  Morocco: "🇲🇦", Senegal: "🇸🇳", Nigeria: "🇳🇬", Ghana: "🇬🇭",
  "Ivory Coast": "🇨🇮", Cameroon: "🇨🇲", Algeria: "🇩🇿", Tunisia: "🇹🇳",
  Egypt: "🇪🇬", "South Africa": "🇿🇦", Mali: "🇲🇱", Gabon: "🇬🇦",
  "Cape Verde": "🇨🇻", "DR Congo": "🇨🇩", Benin: "🇧🇯",
  Japan: "🇯🇵", "South Korea": "🇰🇷", "Saudi Arabia": "🇸🇦", Iran: "🇮🇷",
  Qatar: "🇶🇦", Australia: "🇦🇺", "New Zealand": "🇳🇿",
  Indonesia: "🇮🇩", Uzbekistan: "🇺🇿", Iraq: "🇮🇶", Jordan: "🇯🇴",
  // French names
  "États-Unis": "🇺🇸", "Mexique": "🇲🇽", "Brésil": "🇧🇷", "Argentine": "🇦🇷",
  "Colombie": "🇨🇴", "Équateur": "🇪🇨", "Pérou": "🇵🇪", "Chili": "🇨🇱",
  "Bolivie": "🇧🇴", "Jamaïque": "🇯🇲", "Haïti": "🇭🇹",
  "Salvador": "🇸🇻", "Trinité-et-Tobago": "🇹🇹",
  "Espagne": "🇪🇸", "Allemagne": "🇩🇪", "Angleterre": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "Pays-Bas": "🇳🇱", "Belgique": "🇧🇪", "Italie": "🇮🇹", "Suisse": "🇨🇭",
  "Croatie": "🇭🇷", "Danemark": "🇩🇰", "Suède": "🇸🇪", "Norvège": "🇳🇴",
  "Pologne": "🇵🇱", "Serbie": "🇷🇸", "Écosse": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "Pays de Galles": "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "République Tchèque": "🇨🇿", "Slovaquie": "🇸🇰",
  "Hongrie": "🇭🇺", "Roumanie": "🇷🇴", "Autriche": "🇦🇹",
  "Bosnie-Herzégovine": "🇧🇦", "Slovénie": "🇸🇮", "Albanie": "🇦🇱",
  "Grèce": "🇬🇷", "Turquie": "🇹🇷", "Géorgie": "🇬🇪", "Islande": "🇮🇸",
  "Maroc": "🇲🇦", "Sénégal": "🇸🇳", "Nigéria": "🇳🇬",
  "Côte d'Ivoire": "🇨🇮", "Cameroun": "🇨🇲", "Algérie": "🇩🇿", "Tunisie": "🇹🇳",
  "Égypte": "🇪🇬", "Afrique du Sud": "🇿🇦", "Cap-Vert": "🇨🇻", "RD Congo": "🇨🇩", "Bénin": "🇧🇯",
  "Japon": "🇯🇵", "Corée du Sud": "🇰🇷", "Arabie Saoudite": "🇸🇦",
  "Australie": "🇦🇺", "Nouvelle-Zélande": "🇳🇿", "Irak": "🇮🇶", "Jordanie": "🇯🇴",
  "Indonésie": "🇮🇩", "Ouzbékistan": "🇺🇿",
};

function _resolve(input: string): string {
  if (!input) return "🏳️";

  // Already a real emoji flag: Regional Indicator range (country flags) or 🏴 (subdivision flags)
  const firstCp = input.codePointAt(0) ?? 0;
  if ((firstCp >= 0x1F1E6 && firstCp <= 0x1F1FF) || firstCp === 0x1F3F4) return input;

  // ISO 2-letter code → emoji via Regional Indicator offset
  const trimmed = input.trim();
  if (/^[A-Z]{2}$/i.test(trimmed)) {
    const offset = 127397;
    return Array.from(trimmed.toUpperCase()).map(c => String.fromCodePoint(c.charCodeAt(0) + offset)).join("");
  }

  // Team name lookup (English or French)
  if (TEAM_FLAGS[trimmed]) return TEAM_FLAGS[trimmed];

  return "🏳️";
}

// flagEmoji: accepts ISO code, emoji, or team name (English or French)
export function flagEmoji(input: string): string {
  return _resolve(input);
}

// teamFlag: uses flagCode if it's a real flag, otherwise falls back to team name lookup.
// Use this at call sites where flagCode might be "🏳️" (toFlag() default) or null.
export function teamFlag(flagCode: string | null | undefined, teamName: string): string {
  if (flagCode && flagCode !== "🏳️") {
    const result = _resolve(flagCode);
    if (result !== "🏳️") return result;
  }
  return _resolve(teamName);
}

// Sous-divisions UK (séquences tag, pas des regional indicators) → codes flagcdn.
const SUBDIVISION_FLAGCDN: Record<string, string> = {
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿": "gb-eng", // Angleterre
  "🏴󠁧󠁢󠁳󠁣󠁴󠁿": "gb-sct", // Écosse
  "🏴󠁧󠁢󠁷󠁬󠁳󠁿": "gb-wls", // Pays de Galles
};

// flagImgUrl : URL d'une IMAGE de drapeau (flagcdn.com), rendu universel
// (Windows / Smart TV inclus, contrairement aux emojis). On dérive le code ISO
// directement de l'emoji drapeau (🇪🇸 = E+S → "es"). Renvoie null si non résolu.
export function flagImgUrl(flagCode: string | null | undefined, teamName?: string): string | null {
  const emoji = teamFlag(flagCode, teamName ?? "");
  if (!emoji || emoji === "🏳️") return null;
  if (SUBDIVISION_FLAGCDN[emoji]) return `https://flagcdn.com/${SUBDIVISION_FLAGCDN[emoji]}.svg`;
  const cps = Array.from(emoji).map((c) => c.codePointAt(0) ?? 0);
  if (cps.length >= 2 && cps[0] >= 0x1f1e6 && cps[0] <= 0x1f1ff && cps[1] >= 0x1f1e6 && cps[1] <= 0x1f1ff) {
    const iso = String.fromCharCode(cps[0] - 0x1f1e6 + 97) + String.fromCharCode(cps[1] - 0x1f1e6 + 97);
    return `https://flagcdn.com/${iso}.svg`;
  }
  return null;
}

export function pointsBadge(points: number): string {
  if (points >= 150) return "🥇";
  if (points >= 100) return "🥈";
  if (points >= 50) return "🥉";
  return "💪";
}
