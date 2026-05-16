// Mock IA pour développement local — MOCK_AI=true

import type { MorningBrief } from "@/lib/supabase/types";

export const mockMorningBrief = (): Partial<MorningBrief> => ({
  title: "Les VARcassés en grande forme... de déni",
  body: "Bonne matinale ! La journée d'hier a confirmé ce que tout le monde savait déjà : le football est imprévisible et nos pronostics, eux, sont constants dans leur originalité. Le FC Réunion Inutile a encore frappé fort, principalement à côté du but. Le classement se resserre, la tension monte, le café refroidit.",
  scores_summary: "France 2-1 Brésil • Allemagne 0-0 Espagne",
  leaderboard_summary: "1. Les VARcassés (87pts) • 2. FC Réunion Inutile (72pts) • 3. Goal Average (61pts)",
  fail_of_day: "Le FC Réunion Inutile a parié sur le nul France-Brésil avec 100% de confiance et 0% de raison.",
  fun_fact: "Saviez-vous que Canal+ diffuse des matchs depuis 1984 ? Soit 40 ans à regarder des gens rater des penalties.",
  ai_comment: "Continuez comme ça, les VARcassés. La médiocrité constante, c'est aussi une forme de régularité.",
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
  mvp_comment: "Les VARcassés dominent le classement avec une aisance déconcertante. On commence à se demander s'ils ont une taupe dans chaque équipe nationale.",
  chaos_comment: "Le FC Réunion Inutile reste dans sa philosophie : participer c'est gagner. C'est faux, mais c'est beau.",
});
