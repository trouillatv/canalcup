-- migration_cron_runs_v1
-- Historique des exécutions de cron pour la page /admin/monitoring.
-- Chaque appel à /api/cron/* écrit 1 ligne ici (start + finish).

begin;

create table if not exists public.cron_runs (
  id           uuid primary key default gen_random_uuid(),
  job          text not null,           -- 'morning-brief' / 'sync-matches' / 'daily-content' / …
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running'
    check (status in ('running', 'success', 'failure')),
  error_message text,
  meta         jsonb,                   -- libre : nb d'items synced, durée, etc.
  created_at   timestamptz not null default now()
);

create index if not exists cron_runs_job_started_idx
  on public.cron_runs(job, started_at desc);

-- RLS : lecture authenticated (les admins lisent), pas d'INSERT côté client
-- (les crons passent par service_role qui bypass RLS).
alter table public.cron_runs enable row level security;
drop policy if exists "Lecture cron_runs" on public.cron_runs;
create policy "Lecture cron_runs" on public.cron_runs
  for select to authenticated using (true);

commit;
