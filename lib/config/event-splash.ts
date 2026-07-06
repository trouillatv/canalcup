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
  showUntil: "2026-07-13T13:00:00+11:00", // après le quiz #2 du 13 juil. midi (heure NC)
  emoji: "🎆",
  title: "Grand Quiz CanalCup #2",
  dateLabel: "Lundi 13 juillet",
  timeLabel: "12h00",
  location: "Salle de réunion · ou sur votre téléphone",
  body: [
    "2e (et dernière) manche de qualification avant la Grande Finale du 17 juillet !",
    "En salle de réunion pour les présents, ou depuis votre téléphone sur la page Quiz.",
    "📱 Connectez-vous, répondez en direct — les 5 meilleurs du championnat filent en finale.",
  ],
  primaryCta: { label: "Participer au quiz", href: "/quiz" },
  secondaryLabel: "Entrer dans CanalCup",
};
