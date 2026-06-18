// English → French team name mapping (TheSportsDB uses English)
export const EN_TO_FR: Record<string, string> = {
  // Americas
  "USA": "États-Unis",
  "United States": "États-Unis",
  "Mexico": "Mexique",
  "Brazil": "Brésil",
  "Argentina": "Argentine",
  "Colombia": "Colombie",
  "Ecuador": "Équateur",
  "Paraguay": "Paraguay",
  "Uruguay": "Uruguay",
  "Peru": "Pérou",
  "Chile": "Chili",
  "Venezuela": "Venezuela",
  "Bolivia": "Bolivie",
  "Jamaica": "Jamaïque",
  "Haiti": "Haïti",
  "Canada": "Canada",
  "Panama": "Panama",
  "Costa Rica": "Costa Rica",
  "Honduras": "Honduras",
  "El Salvador": "Salvador",
  "Trinidad and Tobago": "Trinité-et-Tobago",
  "Cuba": "Cuba",
  // Europe
  "France": "France",
  "Spain": "Espagne",
  "Germany": "Allemagne",
  "England": "Angleterre",
  "Portugal": "Portugal",
  "Netherlands": "Pays-Bas",
  "Belgium": "Belgique",
  "Italy": "Italie",
  "Switzerland": "Suisse",
  "Croatia": "Croatie",
  "Denmark": "Danemark",
  "Sweden": "Suède",
  "Norway": "Norvège",
  "Poland": "Pologne",
  "Serbia": "Serbie",
  "Ukraine": "Ukraine",
  "Scotland": "Écosse",
  "Wales": "Pays de Galles",
  "Czech Republic": "République Tchèque",
  "Czechia": "République Tchèque",
  "Slovakia": "Slovaquie",
  "Hungary": "Hongrie",
  "Romania": "Roumanie",
  "Austria": "Autriche",
  "Bosnia-Herzegovina": "Bosnie-Herzégovine",
  "Bosnia & Herzegovina": "Bosnie-Herzégovine",
  "Slovenia": "Slovénie",
  "Albania": "Albanie",
  "Greece": "Grèce",
  "Turkey": "Turquie",
  "Georgia": "Géorgie",
  "Iceland": "Islande",
  // Africa
  "Morocco": "Maroc",
  "Senegal": "Sénégal",
  "Nigeria": "Nigéria",
  "Ghana": "Ghana",
  "Ivory Coast": "Côte d'Ivoire",
  "Cameroon": "Cameroun",
  "Algeria": "Algérie",
  "Tunisia": "Tunisie",
  "Egypt": "Égypte",
  "South Africa": "Afrique du Sud",
  "Mali": "Mali",
  "Gabon": "Gabon",
  "Cape Verde": "Cap-Vert",
  "Cape Verde Islands": "Cap-Vert",
  "DR Congo": "RD Congo",
  "Benin": "Bénin",
  // Asia / Middle-East / Pacific
  "Japan": "Japon",
  "South Korea": "Corée du Sud",
  "Saudi Arabia": "Arabie Saoudite",
  "Iran": "Iran",
  "Iraq": "Irak",
  "Jordan": "Jordanie",
  "Qatar": "Qatar",
  "Australia": "Australie",
  "New Zealand": "Nouvelle-Zélande",
  "Indonesia": "Indonésie",
  "Uzbekistan": "Ouzbékistan",
  // Caribbean / other
  "Curaçao": "Curaçao",
  // Variantes selon le fournisseur (FIFA / API-Football) — mêmes équipes,
  // libellés différents. À compléter dès qu'un nom non traduit apparaît.
  "Korea Republic": "Corée du Sud",
  "Republic of Korea": "Corée du Sud",
  "Korea DPR": "Corée du Nord",
  "North Korea": "Corée du Nord",
  "IR Iran": "Iran",
  "Cabo Verde": "Cap-Vert",
  "Türkiye": "Turquie",
  "Turkiye": "Turquie",
  "Congo DR": "RD Congo",
  "Congo": "RD Congo",
  "Côte d'Ivoire": "Côte d'Ivoire",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Bosnia and Herzegovina": "Bosnie-Herzégovine",
  "Bosnia": "Bosnie-Herzégovine",
  "Czech": "République Tchèque",
  "USA ": "États-Unis",
};

// Index normalisé (sans casse, accents ni ponctuation) construit depuis TOUTES
// les clés anglaises ET les valeurs françaises ci-dessus. Permet de reconnaître
// un nom même mal orthographié par le fournisseur ("czechia", "CZECHIA",
// "Czech Republic ", "Republique tcheque"…) → renvoie toujours le nom français
// canonique. C'est le filet de sécurité pour « tous ceux qui ne sont pas
// reconnus » à l'exact.
function normTeamKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ""); // espaces, tirets, apostrophes, points…
}

const NORM_TO_FR = new Map<string, string>();
for (const [en, fr] of Object.entries(EN_TO_FR)) {
  // Une valeur française ne doit jamais être écrasée par une variante : on ne
  // pose la clé normalisée que si elle n'existe pas déjà.
  if (!NORM_TO_FR.has(normTeamKey(en))) NORM_TO_FR.set(normTeamKey(en), fr);
  if (!NORM_TO_FR.has(normTeamKey(fr))) NORM_TO_FR.set(normTeamKey(fr), fr);
}

export function toFrench(englishName: string): string {
  if (!englishName) return englishName;
  const trimmed = englishName.trim();
  return (
    EN_TO_FR[trimmed] ??
    EN_TO_FR[englishName] ??
    NORM_TO_FR.get(normTeamKey(trimmed)) ??
    trimmed
  );
}

// Reverse: French → English (for matching with TheSportsDB)
const FR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_FR).map(([en, fr]) => [fr, en])
);

export function toEnglish(frenchName: string): string {
  return FR_TO_EN[frenchName] ?? frenchName;
}

// Country flag emojis keyed by English name
export const FLAGS: Record<string, string> = {
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
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", Wales: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", "Czech Republic": "🇨🇿", "Czechia": "🇨🇿",
  Slovakia: "🇸🇰", Hungary: "🇭🇺", Romania: "🇷🇴", Austria: "🇦🇹",
  "Bosnia-Herzegovina": "🇧🇦", "Bosnia & Herzegovina": "🇧🇦", "Bosnia and Herzegovina": "🇧🇦",
  Slovenia: "🇸🇮", Albania: "🇦🇱",
  Greece: "🇬🇷", Turkey: "🇹🇷", "Türkiye": "🇹🇷", Georgia: "🇬🇪", Iceland: "🇮🇸",
  Morocco: "🇲🇦", Senegal: "🇸🇳", Nigeria: "🇳🇬", Ghana: "🇬🇭",
  "Ivory Coast": "🇨🇮", Cameroon: "🇨🇲", Algeria: "🇩🇿", Tunisia: "🇹🇳",
  Egypt: "🇪🇬", "South Africa": "🇿🇦", Mali: "🇲🇱", Gabon: "🇬🇦",
  "Cape Verde": "🇨🇻", "Cape Verde Islands": "🇨🇻", "DR Congo": "🇨🇩", "Congo DR": "🇨🇩", Benin: "🇧🇯",
  Japan: "🇯🇵", "South Korea": "🇰🇷", "Saudi Arabia": "🇸🇦", Iran: "🇮🇷",
  Iraq: "🇮🇶", Jordan: "🇯🇴",
  Qatar: "🇶🇦", Australia: "🇦🇺", "New Zealand": "🇳🇿",
  Indonesia: "🇮🇩", Uzbekistan: "🇺🇿",
};

export function toFlag(englishName: string): string {
  return FLAGS[englishName] ?? "🏳️";
}
