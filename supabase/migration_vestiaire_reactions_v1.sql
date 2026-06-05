-- Reactions on Vestiaire messages. Each reaction counts as a social signal and
-- can create one score_events row for the message author when they have a team.

create table if not exists public.vestiaire_message_reactions (
  id uuid primary key default uuid_generate_v4(),
  message_id uuid not null references public.vestiaire_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (emoji in ('🔥', '😂', '👏', '😱')),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists vestiaire_message_reactions_message_idx
  on public.vestiaire_message_reactions (message_id);
create index if not exists vestiaire_message_reactions_user_idx
  on public.vestiaire_message_reactions (user_id);

alter table public.vestiaire_message_reactions enable row level security;
