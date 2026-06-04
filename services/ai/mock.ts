// Mock IA pour développement local — MOCK_AI=true

import type { MorningBrief } from "@/lib/supabase/types";

export const mockMorningBrief = (): Partial<MorningBrief> => ({
  title: "Matinale Canal Cup — les résultats de la veille",
  body: "Bonne matinale ! La journée d'hier a confirmé ce que tout le monde savait : le football est imprévisible. Le classement évolue, certaines équipes progressent, d'autres dégringolent. La tension monte, le café refroidit.",
  scores_summary: "Résultats disponibles dans l'application",
  leaderboard_summary: "Classement disponible dans l'application",
  fail_of_day: "Un pronostic très courageux a été posé. Le football a eu d'autres idées.",
  fun_fact: "Saviez-vous que Canal+ diffuse des matchs depuis 1984 ? Soit 40 ans à regarder des gens rater des penalties.",
  ai_comment: "Continuez comme ça. Le chaos organisé reste une stratégie.",
  cartoon_url: undefined,
});

export const mockTeamRoast = (teamName: string) => ({
  comment: `${teamName} continue de surprendre, principalement dans le mauvais sens. Leur stratégie de pronostic semble être : choisir ce que le groupe choisit, puis faire l'opposé.`,
  motivation: "Mais on y croit pour vous. Enfin, un peu. Dans les bons jours.",
  reputation_label: "Outsiders confiants",
});

export const mockQuizQuestion = () => ({
  question: "Quelle chaîne a diffusé la première Coupe du Monde en couleur en France ?",
  answer_a: "TF1",
  answer_b: "Canal+",
  answer_c: "Antenne 2",
  answer_d: "FR3",
  correct_answer: "C" as const,
  fun_fact: "C'était en 1982. Canal+ n'existait pas encore — elle sera créée en 1984.",
});

export const mockFailCaption = () =>
  "Niveau confiance 92 % — niveau précision : approximatif";

export const mockWeeklyStory = () => ({
  headline: "Une semaine de chaos organisé, comme d'habitude",
  story: "La semaine s'est terminée comme elle avait commencé : dans la confusion la plus totale. Les pronostics ont été audacieux. Les résultats, imprévisibles. Et le moral des troupes, étonnamment bon pour des gens qui se trompent autant.",
  mvp_comment: "L'équipe de tête domine avec une aisance déconcertante. On commence à se demander si c'est du talent ou de la chance.",
  chaos_comment: "L'équipe en bas du classement reste fidèle à sa philosophie : participer c'est gagner. C'est inexact, mais c'est beau.",
});
