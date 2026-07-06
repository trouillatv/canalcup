// Championnat Quiz CanalCup — configuration (V1 statique, pas de base/admin).
// Le quiz n'est plus une animation ponctuelle : c'est un championnat qui dure
// toute la Coupe du Monde et se termine par une Grande Finale en direct.

export const QUIZ_CHAMPIONSHIP = {
  // Ouverture du Quiz LIVE (heure Nouvelle-Calédonie, UTC+11) : on ne peut pas
  // DÉMARRER une session de quiz Live avant cet instant. Garde-fou anti-lancement
  // accidentel (une session de test oubliée affichait « 🔴 Quiz en direct »).
  // Re-armé pour la 2e phase de qualif (Quiz #2) : impossible de lancer un Live
  // avant le lundi 13 juillet midi (heure NC).
  liveOpenAt: "2026-07-13T12:00:00+11:00",
  liveOpenLabel: "lundi 13 juillet à 12h00 (heure NC)",
  // Nombre de joueurs qualifiés pour la Grande Finale (badge « Qualifié »).
  finalists: 5,
  // Comptes « hors concours » : ils peuvent avoir un score quiz (organisateurs,
  // démos), mais ne prennent JAMAIS une place de finaliste — les 5 places vont
  // aux vrais joueurs. (Ex. le compte participant de l'organisateur.)
  finalsExcludedEmails: ["vincent.trouillat@canal-plus.com"] as string[],
  // Clôture du classement qualificatif : après le 2e quiz (13 juil) + sa fenêtre
  // Solo. Le top 5 est alors figé (les finalistes de la Grande Finale du 17).
  qualifCutoff: "2026-07-14T23:59:00+11:00",
  // Fenêtre du mode Solo : il N'OUVRE qu'à la FIN du Live, et se referme ce
  // nombre d'heures plus tard (pour que personne n'ait les réponses 3 jours
  // après par les collègues). 12 h ≈ « le soir même / le lendemain matin ».
  soloOpenHours: 12,
  // Saison Quiz (statique) : affichée au calendrier/hub. « done » est calculé
  // dynamiquement (nb de quiz Live terminés).
  schedule: [
    { n: 1, label: "Quiz #1", dateLabel: "Ven 3 juil." },
    { n: 2, label: "Quiz #2", dateLabel: "Lun 13 juil." },
  ],
  // Grande Finale Quiz (top 5) — inscrite au programme/calendrier.
  finale: {
    enabled: true,
    dateLabel: "Vendredi 17 juillet",
    timeLabel: "12h00",
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
