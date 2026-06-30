-- migration_quiz_championship_v1
-- Le Quiz devient un CHAMPIONNAT qui dure toute la CdM : les points se CUMULENT
-- sur plusieurs quiz (au lieu d'être effacés à chaque Reset), et on distingue le
-- mode de jeu (Live officiel = 100 % des points ; Solo à distance = points
-- réduits).
--
--   quiz_session_id : à quelle session quiz appartient la réponse (cumul propre,
--                     et le Reset ne vide que la session ciblée).
--   mode            : 'live' (salle, écran projeté) ou 'solo' (joueur seul).

alter table public.quiz_answers
  add column if not exists quiz_session_id uuid references public.quiz_session(id),
  add column if not exists mode text not null default 'live';

alter table public.quiz_answers drop constraint if exists quiz_answers_mode_check;
alter table public.quiz_answers
  add constraint quiz_answers_mode_check check (mode in ('live', 'solo'));

create index if not exists quiz_answers_session_idx on public.quiz_answers (quiz_session_id);
