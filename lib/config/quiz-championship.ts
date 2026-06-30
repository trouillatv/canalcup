// Championnat Quiz CanalCup — configuration (V1 statique, pas de base/admin).
// Le quiz n'est plus une animation ponctuelle : c'est un championnat qui dure
// toute la Coupe du Monde et se termine par une Grande Finale en direct.

export const QUIZ_CHAMPIONSHIP = {
  // Nombre de joueurs qualifiés pour la Grande Finale (badge « Qualifié »).
  finalists: 5,
  // Clôture du classement qualificatif (fin de la période des pronostics).
  // Après cette date, le top N est figé : ce sont les finalistes.
  qualifCutoff: "2026-07-17T23:59:00+11:00",
  // Fenêtre du mode Solo : il N'OUVRE qu'à la FIN du Live, et se referme ce
  // nombre d'heures plus tard (pour que personne n'ait les réponses 3 jours
  // après par les collègues). 12 h ≈ « le soir même / le lendemain matin ».
  soloOpenHours: 12,
  // Saison Quiz (statique) : affichée au calendrier/hub. « done » est calculé
  // dynamiquement (nb de quiz Live terminés).
  schedule: [
    { n: 1, label: "Quiz #1", dateLabel: "Ven 3 juil." },
    { n: 2, label: "Quiz #2", dateLabel: "Lun 13 juil." },
    { n: 3, label: "Quiz #3", dateLabel: "Ven 17 juil." },
  ],
  // Grande Finale Quiz — inscrite au programme/calendrier.
  finale: {
    enabled: true,
    dateLabel: "Lundi 20 juillet",
    timeLabel: "12h00",
    title: "Grande Finale Quiz",
  },
};

// La date de clôture est-elle passée ? (classement qualificatif figé)
export function isQualifClosed(now: number = Date.now()): boolean {
  return now > new Date(QUIZ_CHAMPIONSHIP.qualifCutoff).getTime();
}
