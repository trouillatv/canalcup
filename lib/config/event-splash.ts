// Annonce événementielle affichée au lancement de l'app (cf. EventSplash).
// V1 STATIQUE : on édite ce fichier pour changer le message — pas de table en
// base, pas d'admin (plus tard si besoin). Pour DÉSACTIVER : enabled = false.
//
// Affichage : à chaque (ré)ouverture de l'app, tant que `showUntil` n'est pas
// passé et que l'utilisateur n'a pas fermé l'annonce DANS LA SESSION COURANTE
// (dismiss en sessionStorage uniquement → réapparaît à la prochaine ouverture).

export interface EventSplashConfig {
  enabled: boolean;
  /** ISO : AVANT cet instant, l'annonce ne s'affiche pas encore (ex. « la veille »).
   *  Optionnel — absent = affichable dès maintenant. */
  showFrom?: string;
  /** ISO : après cet instant, l'annonce ne s'affiche plus automatiquement. */
  showUntil: string;
  emoji: string;
  title: string;
  dateLabel: string;
  timeLabel: string;
  location?: string;
  /** Lignes du corps du message. */
  body: string[];
  /** Bouton principal (action). */
  primaryCta: { label: string; href: string };
  /** Bouton de fermeture. */
  secondaryLabel: string;
}

export const EVENT_SPLASH: EventSplashConfig = {
  enabled: true,
  // N'apparaît qu'à partir de la VEILLE (mardi 14 juil.) — avant, l'accueil
  // reste sur matchs/pronos.
  showFrom: "2026-07-14T00:00:00+11:00",
  showUntil: "2026-07-15T13:00:00+11:00", // après le quiz #2 du 15 juil. midi (heure NC)
  emoji: "🎆",
  title: "Grand Quiz CanalCup #2",
  dateLabel: "Mercredi 15 juillet",
  timeLabel: "12h00",
  location: "Salle de réunion · ou sur votre téléphone",
  body: [
    "Le 2e (et dernier) quiz du championnat — le premier a cartonné, on remet ça !",
    "En salle de réunion pour les présents, ou depuis votre téléphone sur la page Quiz.",
    "📱 Connectez-vous, répondez en direct — les points s'ajoutent au classement cumulé des 2 quiz.",
  ],
  primaryCta: { label: "Participer au quiz", href: "/quiz" },
  secondaryLabel: "Entrer dans CanalCup",
};
