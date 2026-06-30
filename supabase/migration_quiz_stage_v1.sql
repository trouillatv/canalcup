-- Quiz « mode présentateur » : l'animateur (Marie) pilote le rythme au lieu du
-- temps. On persiste l'ÉTAPE en cours dans quiz_session.stage pour que la TV, les
-- téléphones et la télécommande présentateur lisent tous le même état.
--
--   question     : chrono (ou « Temps écoulé » tenu, en attente de l'animateur)
--   stats        : répartition des votes dévoilée (PAS encore la bonne réponse)
--   answer       : bonne réponse + explication
--   leaderboard  : classement
--
-- L'avancée se fait via /api/admin/quiz/session action=advance. La phase
-- countdown/question reste dérivée du temps tant que stage='question'.

alter table public.quiz_session
  add column if not exists stage text not null default 'question';

alter table public.quiz_session drop constraint if exists quiz_session_stage_check;
alter table public.quiz_session
  add constraint quiz_session_stage_check
  check (stage in ('question', 'stats', 'answer', 'leaderboard'));
