// Données mock complètes pour développement sans Supabase
import type {
  Team, Match, MorningBrief, RevivezPost,
  BabyFootMatch, QuizQuestion, InboxEvent, LeaderboardRow, PredictionTrend,
  Challenge, ChallengeEntry
} from "./supabase/types";

export const MOCK_TEAMS: Team[] = [
  {
    id: "11111111-0000-0000-0000-000000000001",
    name: "Les VARcassés",
    slogan: "On proteste, donc on existe",
    logo_url: undefined,
    color: "#FFD700",
    total_points: 87,
    reputation_label: "Experts en frustration constructive",
    created_at: "2026-06-01T00:00:00Z",
    members: [
      { id: "u1", name: "Alex M.", email: "alex@canal.fr", football_level: "expert", team_id: "11111111-0000-0000-0000-000000000001", team_role: "captain", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u2", name: "Sarah K.", email: "sarah@canal.fr", football_level: "amateur", team_id: "11111111-0000-0000-0000-000000000001", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u3", name: "Marc D.", email: "marc@canal.fr", football_level: "ambiance", team_id: "11111111-0000-0000-0000-000000000001", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
    ],
  },
  {
    id: "11111111-0000-0000-0000-000000000002",
    name: "FC Réunion Inutile",
    slogan: "On y croit",
    logo_url: undefined,
    color: "#3B82F6",
    total_points: 72,
    reputation_label: "Outsiders perpétuellement confiants",
    created_at: "2026-06-01T00:00:00Z",
    members: [
      { id: "u4", name: "Julie B.", email: "julie@canal.fr", football_level: "ambiance", team_id: "11111111-0000-0000-0000-000000000002", team_role: "captain", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u5", name: "Théo R.", email: "theo@canal.fr", football_level: "amateur", team_id: "11111111-0000-0000-0000-000000000002", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u6", name: "Nina L.", email: "nina@canal.fr", football_level: "ambiance", team_id: "11111111-0000-0000-0000-000000000002", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
    ],
  },
  {
    id: "11111111-0000-0000-0000-000000000003",
    name: "Goal Average",
    slogan: "La précision avant tout (parfois)",
    logo_url: undefined,
    color: "#10B981",
    total_points: 61,
    reputation_label: "Philosophes du nul",
    created_at: "2026-06-01T00:00:00Z",
    members: [
      { id: "u7", name: "Paul G.", email: "paul@canal.fr", football_level: "expert", team_id: "11111111-0000-0000-0000-000000000003", team_role: "captain", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u8", name: "Emma T.", email: "emma@canal.fr", football_level: "ambiance", team_id: "11111111-0000-0000-0000-000000000003", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
      { id: "u9", name: "Luc F.", email: "luc@canal.fr", football_level: "amateur", team_id: "11111111-0000-0000-0000-000000000003", team_role: "member", profile_completed: true, onboarding_step: 1, created_at: "2026-06-01T00:00:00Z" },
    ],
  },
];

export const MOCK_MATCHES: Match[] = [
  {
    id: "22222222-0000-0000-0000-000000000001",
    competition: "Coupe du Monde 2026",
    team_a: "France", team_b: "Brésil", flag_a: "FR", flag_b: "BR",
    starts_at: "2026-06-12T14:00:00Z",
    channel: "beIN Sports 1", status: "finished", score_a: 2, score_b: 1,
    is_match_of_week: true,
    odds: { odds_a: 2.10, odds_draw: 3.40, odds_b: 3.20 },
  },
  {
    id: "22222222-0000-0000-0000-000000000002",
    competition: "Coupe du Monde 2026",
    team_a: "Allemagne", team_b: "Espagne", flag_a: "DE", flag_b: "ES",
    starts_at: "2026-06-13T17:00:00Z",
    channel: "beIN Sports 2", status: "finished", score_a: 0, score_b: 0,
    is_match_of_week: false,
    odds: { odds_a: 2.75, odds_draw: 3.10, odds_b: 2.50 },
  },
  {
    id: "22222222-0000-0000-0000-000000000003",
    competition: "Coupe du Monde 2026",
    team_a: "Argentine", team_b: "Portugal", flag_a: "AR", flag_b: "PT",
    starts_at: "2026-06-14T20:00:00Z",
    channel: "Canal+ Sport", status: "upcoming", score_a: undefined, score_b: undefined,
    is_match_of_week: false,
    odds: { odds_a: 1.95, odds_draw: 3.50, odds_b: 3.80 },
  },
  {
    id: "22222222-0000-0000-0000-000000000004",
    competition: "Coupe du Monde 2026",
    team_a: "Maroc", team_b: "Sénégal", flag_a: "MA", flag_b: "SN",
    starts_at: "2026-06-15T14:00:00Z",
    channel: "beIN Sports 1", status: "upcoming", score_a: undefined, score_b: undefined,
    is_match_of_week: false,
    odds: { odds_a: 2.20, odds_draw: 3.10, odds_b: 3.00 },
  },
  {
    id: "22222222-0000-0000-0000-000000000005",
    competition: "Coupe du Monde 2026",
    team_a: "Japon", team_b: "Corée du Sud", flag_a: "JP", flag_b: "KR",
    starts_at: "2026-06-16T11:00:00Z",
    channel: "beIN Sports 3", status: "upcoming", score_a: undefined, score_b: undefined,
    is_match_of_week: false,
    odds: { odds_a: 2.60, odds_draw: 3.20, odds_b: 2.70 },
  },
];

export const MOCK_MORNING_BRIEF: MorningBrief = {
  id: "33333333-0000-0000-0000-000000000001",
  date: "2026-06-13",
  title: "France 2-1 Brésil : le chaos organisé a gagné",
  body: "La France a battu le Brésil avec deux buts et une quantité raisonnable de VAR. Les Bleus prouvent une fois de plus que la victoire préférée des Français, c'est la victoire surprenante. Le FC Réunion Inutile avait parié sur le nul. Comme d'habitude. Les VARcassés, eux, avaient vu juste.",
  scores_summary: "France 2-1 Brésil • Allemagne 0-0 Espagne",
  leaderboard_summary: "1. Les VARcassés (87pts) • 2. FC Réunion Inutile (72pts) • 3. Goal Average (61pts)",
  fail_of_day: "Le FC Réunion Inutile a parié sur un nul 1-1. Le football leur a répondu 2-1. C'est proche. Dans un univers parallèle.",
  fun_fact: "Saviez-vous que Canal+ a diffusé son premier match en direct en 1984 ? Soit l'année où les télécommandes existaient déjà, contrairement aux VAR.",
  ai_comment: "Continue comme ça, les VARcassés. Une régularité dans les bons résultats, c'est aussi une forme de talent.",
  cartoon_url: undefined,
  created_at: "2026-06-13T06:00:00Z",
};

export const MOCK_REVIVEZ: RevivezPost[] = [
  {
    id: "44444444-0000-0000-0000-000000000001",
    type: "phrase", title: "La citation de la semaine",
    content: '"On avait le bon résultat. Le football, lui, avait une autre idée." — FC Réunion Inutile, après France-Brésil',
    team_id: "11111111-0000-0000-0000-000000000002",
    votes_count: 23, created_at: "2026-06-13T10:00:00Z",
    team: MOCK_TEAMS[1],
  },
  {
    id: "44444444-0000-0000-0000-000000000002",
    type: "fail", title: "Le pronostic du siècle",
    content: "Goal Average a pronostiqué Allemagne 4-0 Espagne. Le match s'est terminé 0-0. La confiance était là. La précision, moins.",
    team_id: "11111111-0000-0000-0000-000000000003",
    votes_count: 41, created_at: "2026-06-13T14:00:00Z",
    team: MOCK_TEAMS[2],
  },
  {
    id: "44444444-0000-0000-0000-000000000003",
    type: "roast", title: "Le coach IA a parlé",
    content: 'Le coach des VARcassés : "Ils gagnent trop. C\'est suspect. Je les surveille."',
    team_id: "11111111-0000-0000-0000-000000000001",
    votes_count: 17, created_at: "2026-06-12T16:00:00Z",
    team: MOCK_TEAMS[0],
  },
  {
    id: "44444444-0000-0000-0000-000000000004",
    type: "babyfoot", title: "Babyfoot : la finale qui a tout déchiré",
    content: "VARcassés vs FC Réunion Inutile : 5-3 après prolongations fictives. Le babyfoot ne connaît pas le nul.",
    votes_count: 31, created_at: "2026-06-12T13:00:00Z",
  },
  {
    id: "44444444-0000-0000-0000-000000000005",
    type: "phrase", title: "Philosophie de tournoi",
    content: '"Participer c\'est gagner." — FC Réunion Inutile (ils participent beaucoup)',
    team_id: "11111111-0000-0000-0000-000000000002",
    votes_count: 55, created_at: "2026-06-11T09:00:00Z",
    team: MOCK_TEAMS[1],
  },
];

export const MOCK_BABYFOOT: BabyFootMatch[] = [
  {
    id: "55555555-0000-0000-0000-000000000001",
    team_a_id: "11111111-0000-0000-0000-000000000001",
    team_b_id: "11111111-0000-0000-0000-000000000002",
    starts_at: "2026-06-12T12:00:00Z",
    round: "Groupes", score_a: 5, score_b: 3, status: "finished",
    highlight: "Les VARcassés ont contesté 3 buts. Tous valides.",
    created_at: "2026-06-12T12:00:00Z",
    team_a: MOCK_TEAMS[0], team_b: MOCK_TEAMS[1],
  },
  {
    id: "55555555-0000-0000-0000-000000000002",
    team_a_id: "11111111-0000-0000-0000-000000000002",
    team_b_id: "11111111-0000-0000-0000-000000000003",
    starts_at: "2026-06-13T12:00:00Z",
    round: "Groupes", score_a: 2, score_b: 4, status: "finished",
    highlight: "Goal Average a vécu à la hauteur de son nom.",
    created_at: "2026-06-13T12:00:00Z",
    team_a: MOCK_TEAMS[1], team_b: MOCK_TEAMS[2],
  },
  {
    id: "55555555-0000-0000-0000-000000000003",
    team_a_id: "11111111-0000-0000-0000-000000000001",
    team_b_id: "11111111-0000-0000-0000-000000000003",
    starts_at: "2026-06-16T12:00:00Z",
    round: "Finale", score_a: undefined, score_b: undefined, status: "upcoming",
    highlight: undefined,
    created_at: "2026-06-16T12:00:00Z",
    team_a: MOCK_TEAMS[0], team_b: MOCK_TEAMS[2],
  },
];

export const MOCK_QUIZ: QuizQuestion[] = [
  {
    id: "66666666-0000-0000-0000-000000000001",
    question: "En quelle année Canal+ a-t-il diffusé son premier match de football ?",
    answer_a: "1980", answer_b: "1984", answer_c: "1987", answer_d: "1992",
    correct_answer: "B", difficulty: "easy", category: "canal",
  },
  {
    id: "66666666-0000-0000-0000-000000000002",
    question: "Combien de pays accueillent la Coupe du Monde 2026 ?",
    answer_a: "1", answer_b: "2", answer_c: "3", answer_d: "4",
    correct_answer: "C", difficulty: "easy", category: "foot",
  },
  {
    id: "66666666-0000-0000-0000-000000000003",
    question: "Quel pays a remporté le plus de Coupes du Monde ?",
    answer_a: "Allemagne", answer_b: "France", answer_c: "Brésil", answer_d: "Argentine",
    correct_answer: "C", difficulty: "medium", category: "foot",
  },
  {
    id: "66666666-0000-0000-0000-000000000004",
    question: "Que signifie VAR dans le football ?",
    answer_a: "Video Assistant Referee", answer_b: "Very Aggressive Referee",
    answer_c: "Virtual Analysis Review", answer_d: "Video Action Replay",
    correct_answer: "A", difficulty: "easy", category: "foot",
  },
  {
    id: "66666666-0000-0000-0000-000000000005",
    question: "Quelle est la durée réglementaire d'un match de football ?",
    answer_a: "80 minutes", answer_b: "90 minutes", answer_c: "100 minutes", answer_d: "120 minutes",
    correct_answer: "B", difficulty: "easy", category: "general",
  },
];

export const MOCK_INBOX: InboxEvent[] = [
  {
    id: "i1", user_id: "u1", team_id: "11111111-0000-0000-0000-000000000001",
    title: "Vous êtes dans la matinale ! 📰",
    message: "Les VARcassés sont mentionnés dans la matinale du 13 juin. Le coach IA a des choses à dire.",
    type: "matinale", is_read: false, created_at: "2026-06-13T06:30:00Z",
  },
  {
    id: "i2", user_id: "u1", team_id: "11111111-0000-0000-0000-000000000001",
    title: "Votre pronostic a rapporté des points 🏆",
    message: "France 2-1 Brésil : votre pronostic victoire France était correct. +10 points !",
    type: "vote_received", is_read: false, created_at: "2026-06-12T23:00:00Z",
  },
  {
    id: "i3", user_id: "u1",
    title: "Badge débloqué : Premier Sang 🩸",
    message: "Vous avez réalisé votre premier pronostic exact. Bienvenue dans le club des clairvoyants.",
    type: "badge", is_read: true, created_at: "2026-06-12T14:05:00Z",
  },
  {
    id: "i4", user_id: "u1", team_id: "11111111-0000-0000-0000-000000000002",
    title: "Le FC Réunion Inutile vous a gentiment clashé 😅",
    message: '"Les VARcassés gagnent trop. Ça commence à être suspect." — FC Réunion Inutile',
    type: "roast", is_read: true, created_at: "2026-06-11T18:00:00Z",
  },
];

export const MOCK_LEADERBOARD: LeaderboardRow[] = [
  {
    team: MOCK_TEAMS[0],
    points_predictions: 50, points_quiz: 20, points_babyfoot: 10, points_votes: 7, points_bonus: 0,
    total: 87, rank: 1,
  },
  {
    team: MOCK_TEAMS[1],
    points_predictions: 35, points_quiz: 15, points_babyfoot: 15, points_votes: 7, points_bonus: 0,
    total: 72, rank: 2,
  },
  {
    team: MOCK_TEAMS[2],
    points_predictions: 30, points_quiz: 12, points_babyfoot: 12, points_votes: 7, points_bonus: 0,
    total: 61, rank: 3,
  },
];

export const MOCK_CHALLENGES: Challenge[] = [
  {
    id: "77777777-0000-0000-0000-000000000001",
    slug: "qui-est-ce-joueur", title: "Qui est ce joueur ?", emoji: "🕵️",
    description: "Reconnaissez le joueur de Coupe du Monde à partir d'indices de plus en plus évidents. La culture foot du bureau au grand jour.",
    rules: "L'animateur projette une silhouette puis des indices (club, sélection, poste). Chaque équipe écrit sa réponse. Bonne réponse aux premiers indices = plus de points.",
    location: "Salle de projection", duration_minutes: 20, max_points: 40,
    category: "challenges", phase: 1, status: "upcoming", sort_order: 10,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000002",
    slug: "reconnaitre-hymne", title: "Reconnaître l'hymne", emoji: "🎵",
    description: "Un extrait d'hymne national, une nation à deviner. Les supporters s'enflamment, les experts doutent.",
    rules: "L'animateur diffuse un extrait d'hymne. La première équipe à lever la main et répondre juste marque.",
    location: "Salle de projection", duration_minutes: 15, max_points: 30,
    category: "challenges", phase: 1, status: "upcoming", sort_order: 20,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000003",
    slug: "le-commentateur", title: "Le Commentateur Canal+", emoji: "🎙️",
    description: "Commentez une action de légende façon Canal+. 30 secondes pour faire vibrer la salle (et le jury).",
    rules: "Chaque équipe désigne un commentateur. Action muette projetée, commentaire en direct. Le jury note la prestation.",
    location: "Scène principale", duration_minutes: 25, max_points: 50,
    category: "challenges", phase: 1, status: "upcoming", sort_order: 30,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000004",
    slug: "concours-jongle", title: "Concours de jongle", emoji: "⚽",
    description: "Le défi le plus simple du monde. En théorie. Un ballon, vos pieds, la pression de tout l'open space.",
    rules: "Un représentant par équipe. Nombre de jongles enchaînées sans faute.",
    location: "Hall / extérieur", duration_minutes: 20, max_points: 40,
    category: "challenges", phase: 1, status: "upcoming", sort_order: 40,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000005",
    slug: "le-bureau-parle", title: "Le Bureau Parle", emoji: "🗣️",
    description: "Le grand quiz oral collaboratif : foot, Canal+, culture G. Toute l'équipe répond, dans la bonne humeur.",
    rules: "Questions posées à l'oral à chaque équipe à tour de rôle. Réponse juste = points.",
    location: "Salle de réunion", duration_minutes: 30, max_points: 60,
    category: "challenges", phase: 1, status: "upcoming", sort_order: 50,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000006",
    slug: "photo-supporters", title: "Photo des supporters", emoji: "📸",
    description: "La plus belle photo d'équipe supporter du tournoi. Créativité, ambiance, esprit Canal Cup.",
    rules: "Phase 2 — Chaque équipe soumet une photo. Vote des autres équipes + coup de cœur du jury.",
    location: "Partout", duration_minutes: undefined, max_points: 30,
    category: "social", phase: 2, status: "upcoming", sort_order: 60,
    created_at: "2026-06-01T00:00:00Z",
  },
  {
    id: "77777777-0000-0000-0000-000000000007",
    slug: "musee-canal-cup", title: "Musée Canal Cup", emoji: "🏛️",
    description: "L'archive vivante du tournoi : meilleurs moments, fails légendaires, citations cultes. 0 point, 100% de plaisir.",
    rules: "Phase 2 — Galerie consultable, sans scoring. La mémoire collective de la Canal Cup.",
    location: "En ligne", duration_minutes: undefined, max_points: 0,
    category: "social", phase: 2, status: "upcoming", sort_order: 70,
    created_at: "2026-06-01T00:00:00Z",
  },
];

export const MOCK_CHALLENGE_ENTRIES: ChallengeEntry[] = [
  {
    id: "88888888-0000-0000-0000-000000000001",
    challenge_id: "77777777-0000-0000-0000-000000000001",
    team_id: "11111111-0000-0000-0000-000000000001",
    title: "Réponse : Kylian Mbappé", points_awarded: 40, status: "approved",
    created_at: "2026-06-12T15:00:00Z", team: MOCK_TEAMS[0],
  },
  {
    id: "88888888-0000-0000-0000-000000000002",
    challenge_id: "77777777-0000-0000-0000-000000000001",
    team_id: "11111111-0000-0000-0000-000000000002",
    title: "Réponse : Vinícius Jr", points_awarded: 20, status: "approved",
    created_at: "2026-06-12T15:01:00Z", team: MOCK_TEAMS[1],
  },
  {
    id: "88888888-0000-0000-0000-000000000003",
    challenge_id: "77777777-0000-0000-0000-000000000005",
    team_id: "11111111-0000-0000-0000-000000000003",
    title: "Manche 1 — 8/10 bonnes réponses", points_awarded: 0, status: "pending",
    created_at: "2026-06-13T11:00:00Z", team: MOCK_TEAMS[2],
  },
];

export const MOCK_PREDICTION_TRENDS: Record<string, PredictionTrend> = {
  "22222222-0000-0000-0000-000000000003": {
    match_id: "22222222-0000-0000-0000-000000000003",
    total: 9, votes_a: 5, votes_draw: 2, votes_b: 2,
    pct_a: 56, pct_draw: 22, pct_b: 22,
  },
  "22222222-0000-0000-0000-000000000004": {
    match_id: "22222222-0000-0000-0000-000000000004",
    total: 9, votes_a: 4, votes_draw: 3, votes_b: 2,
    pct_a: 44, pct_draw: 33, pct_b: 22,
  },
};
