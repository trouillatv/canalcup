// Championnat Quiz CanalCup — configuration (V1 statique, pas de base/admin).
// Le quiz n'est plus une animation ponctuelle : c'est un championnat qui dure
// toute la Coupe du Monde et se termine par une Grande Finale en direct.

export const QUIZ_CHAMPIONSHIP = {
  // Fermeture du Live : on laisse le Solo accessible, mais on ne veut plus
  // lancer de nouvelle session Live sans réactiver explicitement ce drapeau.
  liveEnabled: false,
  // Ouverture du Quiz LIVE (heure Nouvelle-Calédonie, UTC+11) : on ne peut pas
  // DÉMARRER une session de quiz Live avant cet instant. Garde-fou anti-lancement
  // accidentel (une session de test oubliée affichait « 🔴 Quiz en direct »).
  // Re-armé pour le 2e quiz : impossible de lancer un Live avant le mercredi
  // 15 juillet midi (heure NC).
  liveOpenAt: "2026-07-15T12:00:00+11:00",
  liveOpenLabel: "mercredi 15 juillet à 12h00 (heure NC)",
  // Nombre de joueurs qualifiés pour la Grande Finale (badge « Qualifié »).
  finalists: 5,
  // Comptes « hors concours » : ils peuvent avoir un score quiz (organisateurs,
  // démos), mais ne prennent JAMAIS une place de finaliste — les 5 places vont
  // aux vrais joueurs. (Ex. le compte participant de l'organisateur.)
  finalsExcludedEmails: [] as string[],
  // Pas de finale : le championnat = classement CUMULÉ sur les 2 quiz. On fige
  // l'affichage après le 2e quiz (15 juil) + sa fenêtre Solo.
  qualifCutoff: "2026-07-16T23:59:00+11:00",
  // Fenêtre du mode Solo : il N'OUVRE qu'à la FIN du Live, et se referme ce
  // nombre d'heures plus tard (pour que personne n'ait les réponses 3 jours
  // après par les collègues). 12 h ≈ « le soir même / le lendemain matin ».
  soloOpenHours: 12,
  // Saison Quiz (statique) : affichée au calendrier/hub. « done » est calculé
  // dynamiquement (nb de quiz Live terminés).
  schedule: [
    { n: 1, label: "Quiz #1", dateLabel: "Ven 3 juil." },
    { n: 2, label: "Quiz #2", dateLabel: "Mer 15 juil." },
  ],
  // Pas de Grande Finale : le championnat se joue sur le CUMUL des 2 quiz.
  finale: {
    enabled: false,
    dateLabel: "",
    timeLabel: "",
    title: "Grande Finale Quiz",
  },
};

// La date de clôture est-elle passée ? (classement qualificatif figé)
export function isQualifClosed(now: number = Date.now()): boolean {
  return now > new Date(QUIZ_CHAMPIONSHIP.qualifCutoff).getTime();
}

// Ce compte est-il « hors concours » (jamais finaliste, même avec un gros score) ?
export function isFinalsExcluded(email?: string | null): boolean {
  if (!email) return false;
  const list = QUIZ_CHAMPIONSHIP.finalsExcludedEmails.map((e) => e.toLowerCase());
  return list.includes(email.toLowerCase());
}

// Le Quiz Live est-il ouvert (date d'ouverture atteinte) ? Sert de garde-fou au
// DÉMARRAGE d'une session Live (avant : impossible de lancer / de voir « en direct »).
export function isLiveOpen(now: number = Date.now()): boolean {
  return now >= new Date(QUIZ_CHAMPIONSHIP.liveOpenAt).getTime();
}
