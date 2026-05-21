-- migration_qr_counters_v2
-- Ajoute un compteur de scans UNIQUES (1 par appareil/30j) à côté du
-- compteur de vues totales déjà en place. Dédup via cookie navigateur
-- côté route handler — RGPD-friendly (pas d'IP, pas d'UA, juste un
-- UUID anonyme stocké en cookie).

begin;

alter table public.qr_counters
  add column if not exists unique_count int not null default 0;

-- Nouvelle RPC : incrémente vues totales ET scans uniques.
create or replace function public.qr_increment_unique(p_slug text)
returns int
language plpgsql
security definer
as $$
declare v_unique int;
begin
  insert into public.qr_counters (slug, count, unique_count, last_scan_at)
  values (p_slug, 1, 1, now())
  on conflict (slug) do update
    set count = qr_counters.count + 1,
        unique_count = qr_counters.unique_count + 1,
        last_scan_at = now()
  returning unique_count into v_unique;
  return v_unique;
end;
$$;

grant execute on function public.qr_increment_unique(text) to anon, authenticated;

commit;
