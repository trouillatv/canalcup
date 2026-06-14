-- Match comments: discussion per match + per-user read cursor.
-- Run in Supabase SQL Editor after the match tables exist.

create table if not exists public.match_comments (
  id uuid primary key default uuid_generate_v4(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text,
  display_name text,
  body text not null,
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  hidden_at timestamptz,
  hidden_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists match_comments_match_created_idx
  on public.match_comments (match_id, created_at);
create index if not exists match_comments_status_idx
  on public.match_comments (status);

create table if not exists public.match_comment_reads (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.match_comments enable row level security;
alter table public.match_comment_reads enable row level security;

drop policy if exists "Lecture match_comments" on public.match_comments;
create policy "Lecture match_comments"
  on public.match_comments for select to authenticated
  using (status = 'visible');

drop policy if exists "Lecture match_comment_reads" on public.match_comment_reads;
create policy "Lecture match_comment_reads"
  on public.match_comment_reads for select to authenticated
  using (user_id in (select id from public.users where auth_id = auth.uid()));

-- Writes go through API routes using service_role so moderation and profile
-- checks stay centralized.
