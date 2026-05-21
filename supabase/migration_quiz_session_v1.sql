-- migration_quiz_session_v1
-- Quiz LIVE SHOW : l'admin lance le quiz, tous les joueurs voient la
-- même question en même temps, 20s pour répondre, points selon
-- barème quizPoints (5 si <5s, 3 sinon, 0 si faux/timeout). L'admin
-- peut reset toutes les réponses à volonté.
--
-- Une seule session "active" (ended_at IS NULL) à la fois.

begin;

create table if not exists public.quiz_session (
  id uuid primary key default gen_random_uuid(),
  current_question_id uuid references public.quiz_questions(id) on delete set null,
  question_index int not null default 0,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null check (status in ('question', 'finished')) default 'question',
  owner_admin_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 1 SEULE session active à la fois (partial unique index).
create unique index if not exists ux_quiz_session_active
  on public.quiz_session ((1)) where ended_at is null;

commit;
