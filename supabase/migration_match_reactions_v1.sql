-- Match reactions: emoji toggles per user per match.
-- Run after match tables exist.

create table if not exists public.match_reactions (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (match_id, user_id, emoji)
);

create index if not exists match_reactions_match_idx
  on public.match_reactions (match_id);

alter table public.match_reactions enable row level security;

drop policy if exists "Lecture match_reactions" on public.match_reactions;
create policy "Lecture match_reactions"
  on public.match_reactions for select to authenticated
  using (true);

-- Writes go through API routes using the authenticated client (toggle logic).
drop policy if exists "Ecriture match_reactions" on public.match_reactions;
create policy "Ecriture match_reactions"
  on public.match_reactions for all to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_id = auth.uid()));
