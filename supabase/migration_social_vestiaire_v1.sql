-- Social layer for Canal Cup: user-fed news feed, human locker room, and
-- admin moderation reports. Idempotent.

create table if not exists public.feed_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  email text,
  display_name text,
  type text not null default 'ambiance'
    check (type in ('ambiance', 'photo', 'chambrage', 'match', 'babyfoot', 'quiz', 'animation', 'robert')),
  context_type text,
  context_id uuid,
  body text not null,
  image_url text,
  status text not null default 'visible'
    check (status in ('visible', 'hidden')),
  hidden_at timestamptz,
  hidden_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists feed_posts_created_idx on public.feed_posts (created_at desc);
create index if not exists feed_posts_status_idx on public.feed_posts (status);
create index if not exists feed_posts_user_idx on public.feed_posts (user_id);

create table if not exists public.vestiaire_channels (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('general', 'match', 'team', 'animation')),
  title text not null,
  description text,
  team_id uuid references public.teams(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  challenge_id uuid references public.challenges(id) on delete set null,
  is_private boolean not null default false,
  is_active boolean not null default true,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists vestiaire_channels_general_unique
  on public.vestiaire_channels (type)
  where type in ('general', 'animation');
create unique index if not exists vestiaire_channels_team_unique
  on public.vestiaire_channels (team_id)
  where type = 'team' and team_id is not null;
create unique index if not exists vestiaire_channels_match_unique
  on public.vestiaire_channels (match_id)
  where type = 'match' and match_id is not null;

create table if not exists public.vestiaire_messages (
  id uuid primary key default uuid_generate_v4(),
  channel_id uuid not null references public.vestiaire_channels(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  email text,
  display_name text,
  body text not null,
  status text not null default 'visible'
    check (status in ('visible', 'hidden')),
  hidden_at timestamptz,
  hidden_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists vestiaire_messages_channel_created_idx
  on public.vestiaire_messages (channel_id, created_at desc);
create index if not exists vestiaire_messages_status_idx on public.vestiaire_messages (status);

create table if not exists public.moderation_reports (
  id uuid primary key default uuid_generate_v4(),
  window_start timestamptz not null,
  window_end timestamptz not null,
  risk_level text not null default 'low'
    check (risk_level in ('low', 'medium', 'high')),
  summary text not null,
  flagged_items jsonb not null default '[]'::jsonb,
  recommendation text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'ignored')),
  created_at timestamptz not null default now()
);

create index if not exists moderation_reports_created_idx on public.moderation_reports (created_at desc);
create index if not exists moderation_reports_status_idx on public.moderation_reports (status);

insert into public.vestiaire_channels (type, title, description, is_private)
values
  ('general', 'Canal general', 'Toute la Canal Cup, chambrage compris.', false),
  ('animation', 'Animations', 'Quiz, defis, photos supporters et protestations sportives.', false)
on conflict do nothing;

alter table public.feed_posts enable row level security;
alter table public.vestiaire_channels enable row level security;
alter table public.vestiaire_messages enable row level security;
alter table public.moderation_reports enable row level security;
