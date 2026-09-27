// Calendrier réel de la phase de ligue Champions League 2026/27, extrait en
// lecture seule depuis CANAL Sports (`yfhuqsuboqfznnpceosl`, table
// `events`/`event_participants`/`participants`) le 2026-09-25 — Lot 3C,
// checklist point 3 ("utilise autant que possible les vrais résultats").
//
// FAIT : les 144 rencontres (8 journées x 18 matchs), les équipes, le sens
// domicile/extérieur et les 18 résultats de la journée 1 (seule journée
// jouée à ce jour) sont réels, copiés tels quels depuis la base. Aucune
// donnée de classement/cote/force d'équipe n'existe dans le schéma ingéré
// (`participants` n'a aucune colonne de ranking) — voir
// docs/lot3c-scoring-simulation.md section 2 pour ce que ça implique sur les
// profils "favori"/"expert" (aucune fuite de résultat, aucune donnée
// inventée : force synthétique documentée dans team-strength.ts).
//
// Les résultats des journées 2 à 8 ne sont PAS encore joués dans la réalité
// (statut `scheduled` en base) — ils sont générés par le moteur
// (season-generator.ts) à partir du modèle synthétique, jamais copiés ici.

export type RealResult = { home_score: number; away_score: number };

export type CalendarFixture = {
  id: string;
  matchday: number;
  home: string;
  away: string;
  // Résultat réel uniquement si déjà joué (journée 1) ; null sinon.
  realResult: RealResult | null;
};

export const CALENDAR: CalendarFixture[] = [
  // --- Journée 1 (réelle, jouée, 18/18 finished) ---
  { id: "461ba857", matchday: 1, home: "Club Brugge KV", away: "Aston Villa FC", realResult: { home_score: 2, away_score: 3 } },
  { id: "67585ef4", matchday: 1, home: "PAE AEK", away: "LASK Linz", realResult: { home_score: 1, away_score: 0 } },
  { id: "66093e05", matchday: 1, home: "Real Madrid CF", away: "FC Internazionale Milano", realResult: { home_score: 2, away_score: 1 } },
  { id: "52874892", matchday: 1, home: "FC Porto", away: "Manchester City FC", realResult: { home_score: 0, away_score: 2 } },
  { id: "e8b48f5e", matchday: 1, home: "Borussia Dortmund", away: "Villarreal CF", realResult: { home_score: 3, away_score: 2 } },
  { id: "754b2ae3", matchday: 1, home: "Lille OSC", away: "Real Betis Balompié", realResult: { home_score: 2, away_score: 3 } },
  { id: "3aceabeb", matchday: 1, home: "FC Barcelona", away: "Feyenoord Rotterdam", realResult: { home_score: 5, away_score: 1 } },
  { id: "393b86fa", matchday: 1, home: "VfB Stuttgart", away: "Viking FK", realResult: { home_score: 3, away_score: 1 } },
  { id: "eebdf3a2", matchday: 1, home: "Liverpool FC", away: "Club Atlético de Madrid", realResult: { home_score: 2, away_score: 1 } },
  { id: "9384de52", matchday: 1, home: "Paris Saint-Germain FC", away: "ŠK Slovan Bratislava", realResult: { home_score: 6, away_score: 1 } },
  { id: "8a248e9f", matchday: 1, home: "SSC Napoli", away: "Arsenal FC", realResult: { home_score: 0, away_score: 1 } },
  { id: "8356da6b", matchday: 1, home: "Sporting Clube de Portugal", away: "Galatasaray SK", realResult: { home_score: 3, away_score: 1 } },
  { id: "33b864a2", matchday: 1, home: "Fenerbahçe SK", away: "AS Roma", realResult: { home_score: 1, away_score: 1 } },
  { id: "d1a79b8c", matchday: 1, home: "PSV", away: "FK Shakhtar Donetsk", realResult: { home_score: 1, away_score: 1 } },
  { id: "acc24181", matchday: 1, home: "FC Bayern München", away: "FK Bodø/Glimt", realResult: { home_score: 5, away_score: 0 } },
  { id: "4359f8d8", matchday: 1, home: "Manchester United FC", away: "Sabah FK", realResult: { home_score: 4, away_score: 0 } },
  { id: "d42fd1b8", matchday: 1, home: "Como 1907", away: "RB Leipzig", realResult: { home_score: 4, away_score: 1 } },
  { id: "e476ba10", matchday: 1, home: "SK Slavia Praha", away: "Racing Club de Lens", realResult: { home_score: 2, away_score: 3 } },

  // --- Journée 2 (scheduled, pas encore jouée) ---
  { id: "ed8e8047", matchday: 2, home: "Racing Club de Lens", away: "Sporting Clube de Portugal", realResult: null },
  { id: "cd014b29", matchday: 2, home: "Sabah FK", away: "SK Slavia Praha", realResult: null },
  { id: "afa87368", matchday: 2, home: "FC Internazionale Milano", away: "Club Brugge KV", realResult: null },
  { id: "6260b626", matchday: 2, home: "Galatasaray SK", away: "FC Barcelona", realResult: null },
  { id: "35db3ed6", matchday: 2, home: "Club Atlético de Madrid", away: "Manchester United FC", realResult: null },
  { id: "64c76737", matchday: 2, home: "Arsenal FC", away: "Lille OSC", realResult: null },
  { id: "9f1a8078", matchday: 2, home: "Viking FK", away: "FC Bayern München", realResult: null },
  { id: "89b4b9ee", matchday: 2, home: "RB Leipzig", away: "PSV", realResult: null },
  { id: "2dbd9897", matchday: 2, home: "Villarreal CF", away: "SSC Napoli", realResult: null },
  { id: "f2637821", matchday: 2, home: "LASK Linz", away: "Liverpool FC", realResult: null },
  { id: "b6bf1d56", matchday: 2, home: "Feyenoord Rotterdam", away: "Como 1907", realResult: null },
  { id: "1fbe5a41", matchday: 2, home: "AS Roma", away: "Real Madrid CF", realResult: null },
  { id: "9069ee03", matchday: 2, home: "Manchester City FC", away: "Paris Saint-Germain FC", realResult: null },
  { id: "0aa3dafa", matchday: 2, home: "FK Bodø/Glimt", away: "Borussia Dortmund", realResult: null },
  { id: "43cd42d0", matchday: 2, home: "Aston Villa FC", away: "Fenerbahçe SK", realResult: null },
  { id: "2a106e1f", matchday: 2, home: "Real Betis Balompié", away: "FC Porto", realResult: null },
  { id: "c342bf3e", matchday: 2, home: "FK Shakhtar Donetsk", away: "PAE AEK", realResult: null },
  { id: "d698cca0", matchday: 2, home: "ŠK Slovan Bratislava", away: "VfB Stuttgart", realResult: null },

  // --- Journée 3 ---
  { id: "cbe55332", matchday: 3, home: "Sabah FK", away: "Borussia Dortmund", realResult: null },
  { id: "984e1b6b", matchday: 3, home: "Fenerbahçe SK", away: "SK Slavia Praha", realResult: null },
  { id: "f624c384", matchday: 3, home: "Manchester City FC", away: "PAE AEK", realResult: null },
  { id: "a902e674", matchday: 3, home: "VfB Stuttgart", away: "Club Atlético de Madrid", realResult: null },
  { id: "f51499fa", matchday: 3, home: "Liverpool FC", away: "Villarreal CF", realResult: null },
  { id: "a15565fa", matchday: 3, home: "AS Roma", away: "ŠK Slovan Bratislava", realResult: null },
  { id: "cf3e4d6a", matchday: 3, home: "FC Porto", away: "PSV", realResult: null },
  { id: "27f6d539", matchday: 3, home: "SSC Napoli", away: "FK Bodø/Glimt", realResult: null },
  { id: "d3bb16b6", matchday: 3, home: "Paris Saint-Germain FC", away: "FC Barcelona", realResult: null },
  { id: "9dda7562", matchday: 3, home: "Como 1907", away: "Manchester United FC", realResult: null },
  { id: "f3768c5b", matchday: 3, home: "Lille OSC", away: "Galatasaray SK", realResult: null },
  { id: "0d0dfe9b", matchday: 3, home: "Real Madrid CF", away: "RB Leipzig", realResult: null },
  { id: "af01ae1e", matchday: 3, home: "FC Internazionale Milano", away: "FK Shakhtar Donetsk", realResult: null },
  { id: "5374c4db", matchday: 3, home: "FC Bayern München", away: "Arsenal FC", realResult: null },
  { id: "8b52dd8c", matchday: 3, home: "Club Brugge KV", away: "Racing Club de Lens", realResult: null },
  { id: "52909460", matchday: 3, home: "Aston Villa FC", away: "Viking FK", realResult: null },
  { id: "1f51f740", matchday: 3, home: "Sporting Clube de Portugal", away: "LASK Linz", realResult: null },
  { id: "9c7343a7", matchday: 3, home: "Real Betis Balompié", away: "Feyenoord Rotterdam", realResult: null },

  // --- Journée 4 ---
  { id: "f0e98499", matchday: 4, home: "FK Shakhtar Donetsk", away: "Sporting Clube de Portugal", realResult: null },
  { id: "8df31a62", matchday: 4, home: "Galatasaray SK", away: "VfB Stuttgart", realResult: null },
  { id: "6567aac1", matchday: 4, home: "Feyenoord Rotterdam", away: "FC Internazionale Milano", realResult: null },
  { id: "0717099a", matchday: 4, home: "FC Barcelona", away: "Aston Villa FC", realResult: null },
  { id: "4cee344c", matchday: 4, home: "Club Atlético de Madrid", away: "FC Bayern München", realResult: null },
  { id: "79c9ffb2", matchday: 4, home: "Villarreal CF", away: "Paris Saint-Germain FC", realResult: null },
  { id: "5b191203", matchday: 4, home: "Manchester United FC", away: "AS Roma", realResult: null },
  { id: "e9ae98d5", matchday: 4, home: "FK Bodø/Glimt", away: "Lille OSC", realResult: null },
  { id: "555dbff4", matchday: 4, home: "LASK Linz", away: "ŠK Slovan Bratislava", realResult: null },
  { id: "9d3900f9", matchday: 4, home: "PAE AEK", away: "Real Madrid CF", realResult: null },
  { id: "3f7e3166", matchday: 4, home: "Fenerbahçe SK", away: "Liverpool FC", realResult: null },
  { id: "1bf32b96", matchday: 4, home: "RB Leipzig", away: "Manchester City FC", realResult: null },
  { id: "1c87b222", matchday: 4, home: "SK Slavia Praha", away: "Arsenal FC", realResult: null },
  { id: "b79895a3", matchday: 4, home: "PSV", away: "Club Brugge KV", realResult: null },
  { id: "1a0feb44", matchday: 4, home: "Borussia Dortmund", away: "Real Betis Balompié", realResult: null },
  { id: "2d3f1549", matchday: 4, home: "FC Porto", away: "SSC Napoli", realResult: null },
  { id: "948e1384", matchday: 4, home: "Racing Club de Lens", away: "Como 1907", realResult: null },
  { id: "796df705", matchday: 4, home: "Viking FK", away: "Sabah FK", realResult: null },

  // --- Journée 5 ---
  { id: "97f59040", matchday: 5, home: "Galatasaray SK", away: "Aston Villa FC", realResult: null },
  { id: "1378f271", matchday: 5, home: "FK Bodø/Glimt", away: "LASK Linz", realResult: null },
  { id: "03240ddb", matchday: 5, home: "Real Madrid CF", away: "PSV", realResult: null },
  { id: "80988db2", matchday: 5, home: "Manchester City FC", away: "SSC Napoli", realResult: null },
  { id: "1e4287b2", matchday: 5, home: "Arsenal FC", away: "Borussia Dortmund", realResult: null },
  { id: "65c1785c", matchday: 5, home: "Feyenoord Rotterdam", away: "FC Porto", realResult: null },
  { id: "82fc21ee", matchday: 5, home: "ŠK Slovan Bratislava", away: "Real Betis Balompié", realResult: null },
  { id: "810cb73d", matchday: 5, home: "RB Leipzig", away: "Racing Club de Lens", realResult: null },
  { id: "3de235e0", matchday: 5, home: "Como 1907", away: "PAE AEK", realResult: null },
  { id: "1c16d372", matchday: 5, home: "Sabah FK", away: "FC Barcelona", realResult: null },
  { id: "7794c559", matchday: 5, home: "SK Slavia Praha", away: "Villarreal CF", realResult: null },
  { id: "93f0ea87", matchday: 5, home: "FC Internazionale Milano", away: "VfB Stuttgart", realResult: null },
  { id: "b367c75e", matchday: 5, home: "Club Atlético de Madrid", away: "Viking FK", realResult: null },
  { id: "47b7b161", matchday: 5, home: "Paris Saint-Germain FC", away: "AS Roma", realResult: null },
  { id: "243c92af", matchday: 5, home: "Club Brugge KV", away: "Liverpool FC", realResult: null },
  { id: "8bd15eb1", matchday: 5, home: "Lille OSC", away: "FC Bayern München", realResult: null },
  { id: "b42de5ab", matchday: 5, home: "Sporting Clube de Portugal", away: "Manchester United FC", realResult: null },
  { id: "e9b539c3", matchday: 5, home: "FK Shakhtar Donetsk", away: "Fenerbahçe SK", realResult: null },

  // --- Journée 6 ---
  { id: "da55731a", matchday: 6, home: "Villarreal CF", away: "Sabah FK", realResult: null },
  { id: "9d5c4d51", matchday: 6, home: "Viking FK", away: "Feyenoord Rotterdam", realResult: null },
  { id: "7d48d243", matchday: 6, home: "FC Barcelona", away: "Manchester City FC", realResult: null },
  { id: "d3c0e351", matchday: 6, home: "Aston Villa FC", away: "Paris Saint-Germain FC", realResult: null },
  { id: "fbdf11af", matchday: 6, home: "FC Bayern München", away: "SK Slavia Praha", realResult: null },
  { id: "a9ea270e", matchday: 6, home: "SSC Napoli", away: "Club Brugge KV", realResult: null },
  { id: "74b1f94d", matchday: 6, home: "AS Roma", away: "Sporting Clube de Portugal", realResult: null },
  { id: "f5ed2173", matchday: 6, home: "Manchester United FC", away: "RB Leipzig", realResult: null },
  { id: "9305ee0c", matchday: 6, home: "PAE AEK", away: "Galatasaray SK", realResult: null },
  { id: "f2b6db2b", matchday: 6, home: "Real Betis Balompié", away: "Como 1907", realResult: null },
  { id: "61491678", matchday: 6, home: "ŠK Slovan Bratislava", away: "FK Shakhtar Donetsk", realResult: null },
  { id: "3b55c9ec", matchday: 6, home: "Arsenal FC", away: "Real Madrid CF", realResult: null },
  { id: "4a9596a6", matchday: 6, home: "Borussia Dortmund", away: "FC Internazionale Milano", realResult: null },
  { id: "4358fc5e", matchday: 6, home: "PSV", away: "Club Atlético de Madrid", realResult: null },
  { id: "e6eee0aa", matchday: 6, home: "Liverpool FC", away: "FC Porto", realResult: null },
  { id: "7776d5dc", matchday: 6, home: "Racing Club de Lens", away: "FK Bodø/Glimt", realResult: null },
  { id: "dbbbd34b", matchday: 6, home: "LASK Linz", away: "Fenerbahçe SK", realResult: null },
  { id: "eefb5ca0", matchday: 6, home: "VfB Stuttgart", away: "Lille OSC", realResult: null },

  // --- Journée 7 ---
  { id: "ef102a6f", matchday: 7, home: "FK Bodø/Glimt", away: "Club Atlético de Madrid", realResult: null },
  { id: "f8ee44e1", matchday: 7, home: "Galatasaray SK", away: "Feyenoord Rotterdam", realResult: null },
  { id: "b6a22448", matchday: 7, home: "Real Madrid CF", away: "LASK Linz", realResult: null },
  { id: "7a6baa37", matchday: 7, home: "FC Internazionale Milano", away: "Liverpool FC", realResult: null },
  { id: "71faf8a3", matchday: 7, home: "VfB Stuttgart", away: "Club Brugge KV", realResult: null },
  { id: "d6de5f77", matchday: 7, home: "Aston Villa FC", away: "Borussia Dortmund", realResult: null },
  { id: "fd46e42f", matchday: 7, home: "PAE AEK", away: "AS Roma", realResult: null },
  { id: "bb806ccf", matchday: 7, home: "FC Porto", away: "SK Slavia Praha", realResult: null },
  { id: "54f27ce0", matchday: 7, home: "Lille OSC", away: "ŠK Slovan Bratislava", realResult: null },
  { id: "8ea38a81", matchday: 7, home: "Fenerbahçe SK", away: "Villarreal CF", realResult: null },
  { id: "cc51d053", matchday: 7, home: "Sabah FK", away: "SSC Napoli", realResult: null },
  { id: "e58567b3", matchday: 7, home: "Racing Club de Lens", away: "Manchester City FC", realResult: null },
  { id: "58bc9f2d", matchday: 7, home: "Sporting Clube de Portugal", away: "FC Barcelona", realResult: null },
  { id: "8ff62546", matchday: 7, home: "Como 1907", away: "Paris Saint-Germain FC", realResult: null },
  { id: "b004bc71", matchday: 7, home: "Real Betis Balompié", away: "Arsenal FC", realResult: null },
  { id: "5d236b9a", matchday: 7, home: "Manchester United FC", away: "FC Bayern München", realResult: null },
  { id: "cc14d193", matchday: 7, home: "Viking FK", away: "PSV", realResult: null },
  { id: "b4af5f5a", matchday: 7, home: "RB Leipzig", away: "FK Shakhtar Donetsk", realResult: null },

  // --- Journée 8 ---
  { id: "139342b0", matchday: 8, home: "FK Shakhtar Donetsk", away: "Real Madrid CF", realResult: null },
  { id: "c34e0ed1", matchday: 8, home: "Manchester City FC", away: "Sporting Clube de Portugal", realResult: null },
  { id: "ccadff84", matchday: 8, home: "ŠK Slovan Bratislava", away: "FC Internazionale Milano", realResult: null },
  { id: "9452d26a", matchday: 8, home: "FC Barcelona", away: "Como 1907", realResult: null },
  { id: "c49c36e9", matchday: 8, home: "Club Atlético de Madrid", away: "Fenerbahçe SK", realResult: null },
  { id: "520c5600", matchday: 8, home: "Paris Saint-Germain FC", away: "Galatasaray SK", realResult: null },
  { id: "828965e8", matchday: 8, home: "Liverpool FC", away: "Racing Club de Lens", realResult: null },
  { id: "f4ccb579", matchday: 8, home: "Arsenal FC", away: "Sabah FK", realResult: null },
  { id: "03729fc2", matchday: 8, home: "FC Bayern München", away: "Real Betis Balompié", realResult: null },
  { id: "003e8705", matchday: 8, home: "Club Brugge KV", away: "FK Bodø/Glimt", realResult: null },
  { id: "7f7950d4", matchday: 8, home: "Borussia Dortmund", away: "PAE AEK", realResult: null },
  { id: "d496b0ea", matchday: 8, home: "SK Slavia Praha", away: "Aston Villa FC", realResult: null },
  { id: "3a7cd6b3", matchday: 8, home: "AS Roma", away: "Lille OSC", realResult: null },
  { id: "f67bf072", matchday: 8, home: "LASK Linz", away: "FC Porto", realResult: null },
  { id: "2a3ff18f", matchday: 8, home: "Villarreal CF", away: "Manchester United FC", realResult: null },
  { id: "f92487bb", matchday: 8, home: "PSV", away: "VfB Stuttgart", realResult: null },
  { id: "f74e371a", matchday: 8, home: "Feyenoord Rotterdam", away: "RB Leipzig", realResult: null },
  { id: "dc02d766", matchday: 8, home: "SSC Napoli", away: "Viking FK", realResult: null },
];

export const ALL_TEAMS: string[] = Array.from(
  new Set(CALENDAR.flatMap((f) => [f.home, f.away]))
).sort();

// Sanity checks structurels (pas des tests, juste des invariants toujours
// vrais si la transcription depuis la base est fidèle) :
// - 144 fixtures, 8 journées x 18.
// - 36 équipes, chacune joue exactement 1 fois par journée (8 apparitions
//   au total sur la phase de ligue, format UEFA réel).
// - Journée 1 : 18 résultats réels ; journées 2-8 : aucun (null).
