// ─────────────────────────────────────────────────────────────────────────────
//  Classement FIFA des 48 sélections qualifiées pour la Coupe du Monde 2026.
//  Source : classement FIFA officiel (juin 2026).
//  Noms canoniques = ceux de groups-2026.ts (français, tirage officiel).
// ─────────────────────────────────────────────────────────────────────────────

export type Confederation = "UEFA" | "CONMEBOL" | "CAF" | "AFC" | "CONCACAF" | "OFC";

export interface FIFARankEntry {
  name: string;
  rank: number;
  confederation: Confederation;
}

export const FIFA_RANKS: FIFARankEntry[] = [
  { name: "France",              rank: 1,  confederation: "UEFA"      },
  { name: "Espagne",             rank: 2,  confederation: "UEFA"      },
  { name: "Argentine",           rank: 3,  confederation: "CONMEBOL"  },
  { name: "Angleterre",          rank: 4,  confederation: "UEFA"      },
  { name: "Portugal",            rank: 5,  confederation: "UEFA"      },
  { name: "Brésil",              rank: 6,  confederation: "CONMEBOL"  },
  { name: "Pays-Bas",            rank: 7,  confederation: "UEFA"      },
  { name: "Maroc",               rank: 8,  confederation: "CAF"       },
  { name: "Belgique",            rank: 9,  confederation: "UEFA"      },
  { name: "Allemagne",           rank: 10, confederation: "UEFA"      },
  { name: "Croatie",             rank: 11, confederation: "UEFA"      },
  { name: "Colombie",            rank: 13, confederation: "CONMEBOL"  },
  { name: "Sénégal",             rank: 14, confederation: "CAF"       },
  { name: "Mexique",             rank: 15, confederation: "CONCACAF"  },
  { name: "États-Unis",          rank: 16, confederation: "CONCACAF"  },
  { name: "Uruguay",             rank: 17, confederation: "CONMEBOL"  },
  { name: "Japon",               rank: 18, confederation: "AFC"       },
  { name: "Suisse",              rank: 19, confederation: "UEFA"      },
  { name: "Iran",                rank: 21, confederation: "AFC"       },
  { name: "Turquie",             rank: 22, confederation: "UEFA"      },
  { name: "Équateur",            rank: 23, confederation: "CONMEBOL"  },
  { name: "Autriche",            rank: 24, confederation: "UEFA"      },
  { name: "Corée du Sud",        rank: 25, confederation: "AFC"       },
  { name: "Australie",           rank: 27, confederation: "AFC"       },
  { name: "Algérie",             rank: 28, confederation: "CAF"       },
  { name: "Égypte",              rank: 29, confederation: "CAF"       },
  { name: "Canada",              rank: 30, confederation: "CONCACAF"  },
  { name: "Norvège",             rank: 31, confederation: "UEFA"      },
  { name: "Panama",              rank: 33, confederation: "CONCACAF"  },
  { name: "Côte d'Ivoire",       rank: 34, confederation: "CAF"       },
  { name: "Suède",               rank: 38, confederation: "UEFA"      },
  { name: "Paraguay",            rank: 40, confederation: "CONMEBOL"  },
  { name: "République Tchèque",  rank: 41, confederation: "UEFA"      },
  { name: "Écosse",              rank: 43, confederation: "UEFA"      },
  { name: "Tunisie",             rank: 44, confederation: "CAF"       },
  { name: "RD Congo",            rank: 46, confederation: "CAF"       },
  { name: "Ouzbékistan",         rank: 50, confederation: "AFC"       },
  { name: "Qatar",               rank: 55, confederation: "AFC"       },
  { name: "Irak",                rank: 57, confederation: "AFC"       },
  { name: "Afrique du Sud",      rank: 60, confederation: "CAF"       },
  { name: "Arabie Saoudite",     rank: 61, confederation: "AFC"       },
  { name: "Jordanie",            rank: 63, confederation: "AFC"       },
  { name: "Bosnie-Herzégovine",  rank: 65, confederation: "UEFA"      },
  { name: "Cap-Vert",            rank: 69, confederation: "CAF"       },
  { name: "Ghana",               rank: 72, confederation: "CAF"       },
  { name: "Curaçao",             rank: 82, confederation: "CONCACAF"  },
  { name: "Haïti",               rank: 83, confederation: "CONCACAF"  },
  { name: "Nouvelle-Zélande",    rank: 85, confederation: "OFC"       },
];

// ─── Index normalisé pour lookup robuste (accents/casse) ────────────────────

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES: Record<string, string> = {
  "tchecuie": "republique tcheque",
  "tcheque": "republique tcheque",
  "republique tcheque": "republique tcheque",
  "mexico": "mexique",
  "usa": "etats unis",
  "united states": "etats unis",
};

const BY_NORM = new Map<string, FIFARankEntry>();
for (const e of FIFA_RANKS) {
  BY_NORM.set(norm(e.name), e);
}

/** Rang FIFA + confédération pour un nom d'équipe (français ou alias), null si absent. */
export function getFIFARank(teamName: string): FIFARankEntry | null {
  if (!teamName) return null;
  const n = norm(teamName);
  return BY_NORM.get(ALIASES[n] ?? n) ?? BY_NORM.get(n) ?? null;
}
