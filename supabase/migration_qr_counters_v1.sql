-- migration_qr_counters_v1
-- Compteur de visites par "slug" pour les pages QR publiques.
-- Pas de tracking IP/UA (RGPD-friendly), simple compteur incrémental.
--
-- Le seul slug en service au lancement : 'welcome' (affiche CDM-2026.jpeg).

begin;

create table if not exists public.qr_counters (
  slug text primary key,
  count int not null default 0,
  last_scan_at timestamptz,
  created_at timestamptz not null default now()
);

-- RPC d'incrément atomique. SECURITY DEFINER = exécutée avec les droits
-- du propriétaire (postgres), donc la page publique anon peut l'appeler
-- sans avoir besoin d'autorisation INSERT sur la table.
create or replace function public.qr_increment(p_slug text)
returns int
language plpgsql
security definer
as $$
declare v_count int;
begin
  insert into public.qr_counters (slug, count, last_scan_at)
  values (p_slug, 1, now())
  on conflict (slug) do update
    set count = qr_counters.count + 1,
        last_scan_at = now()
  returning count into v_count;
  return v_count;
end;
$$;

grant execute on function public.qr_increment(text) to anon, authenticated;

-- RLS : on enable, on autorise SELECT à authenticated (pour l'admin),
-- pas d'INSERT/UPDATE/DELETE direct — passe par la RPC.
alter table public.qr_counters enable row level security;
drop policy if exists "Lecture qr_counters" on public.qr_counters;
create policy "Lecture qr_counters" on public.qr_counters
  for select to authenticated using (true);

-- Bootstrap le compteur 'welcome'.
insert into public.qr_counters (slug) values ('welcome')
on conflict do nothing;

commit;
