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
  Indonesia: "🇮🇩", Uzbekistan: "🇺🇿",
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
  "Australie": "🇦🇺", "Nouvelle-Zélande": "🇳🇿",
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

export function pointsBadge(points: number): string {
  if (points >= 150) return "🥇";
  if (points >= 100) return "🥈";
  if (points >= 50) return "🥉";
  return "💪";
}
