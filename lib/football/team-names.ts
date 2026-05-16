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
  "Slovakia": "Slovaquie",
  "Hungary": "Hongrie",
  "Romania": "Roumanie",
  "Austria": "Autriche",
  "Bosnia-Herzegovina": "Bosnie-Herzégovine",
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
  "DR Congo": "RD Congo",
  "Benin": "Bénin",
  // Asia / Middle-East / Pacific
  "Japan": "Japon",
  "South Korea": "Corée du Sud",
  "Saudi Arabia": "Arabie Saoudite",
  "Iran": "Iran",
  "Qatar": "Qatar",
  "Australia": "Australie",
  "New Zealand": "Nouvelle-Zélande",
  "Indonesia": "Indonésie",
  "Uzbekistan": "Ouzbékistan",
  // Caribbean / other
  "Curaçao": "Curaçao",
};

export function toFrench(englishName: string): string {
  return EN_TO_FR[englishName] ?? englishName;
}

// Reverse: French → English (for matching with TheSportsDB)
const FR_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_FR).map(([en, fr]) => [fr, en])
);

export function toEnglish(frenchName: string): string {
  return FR_TO_EN[frenchName] ?? frenchName;
}
