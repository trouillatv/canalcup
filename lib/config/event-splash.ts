// Annonce événementielle affichée au lancement de l'app (cf. EventSplash).
// V1 STATIQUE : on édite ce fichier pour changer le message — pas de table en
// base, pas d'admin (plus tard si besoin). Pour DÉSACTIVER : enabled = false.
//
// Affichage : à chaque (ré)ouverture de l'app, tant que `showUntil` n'est pas
// passé et que l'utilisateur n'a pas fermé l'annonce DANS LA SESSION COURANTE
// (dismiss en sessionStorage uniquement → réapparaît à la prochaine ouverture).

export interface EventSplashConfig {
  enabled: boolean;
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
  showUntil: "2026-07-03T13:00:00+11:00", // après le quiz du 3 juil. midi (heure NC)
  emoji: "🎆",
  title: "Grand Quiz CanalCup",
  dateLabel: "Vendredi 3 juillet",
  timeLabel: "12h00",
  location: "Salle de réunion · ou sur votre téléphone",
  body: [
    "Le quiz pourra se tenir en salle de réunion pour ceux qui sont présents.",
    "Il sera aussi disponible depuis votre ordinateur ou téléphone, directement sur la page Quiz de l'application.",
    "📱 Connectez-vous, répondez en direct, et tentez de faire gagner des points à votre équipe.",
  ],
  primaryCta: { label: "Participer au quiz", href: "/quiz-live" },
  secondaryLabel: "Entrer dans CanalCup",
};
