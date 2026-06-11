alter table public.predictions
  add column if not exists updated_at timestamptz not null default now();

update public.predictions
set updated_at = coalesce(updated_at, created_at, now())
where updated_at is null;

create or replace function public.set_predictions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_predictions_updated_at on public.predictions;
create trigger trg_predictions_updated_at
before update on public.predictions
for each row execute function public.set_predictions_updated_at();
