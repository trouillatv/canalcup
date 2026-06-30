-- Pression par équipe (momentum) — snapshots horodatés des stats live cumulées.
--
-- À chaque poll live (cron/live-matches), on enregistre un instantané des stats
-- cumulées du match (tirs cadrés, tirs dans la surface, tirs totaux, corners,
-- xG, possession). La courbe de pression divergente (vert = équipe A pousse,
-- bleu = équipe B) est DÉRIVÉE à la lecture en diffant les snapshots
-- consécutifs → une barre par tranche captée. On stocke le brut (jsonb) pour
-- pouvoir re-régler la pondération sans recollecter.
--
-- Granularité : la clé `t` est un bucket de 30 s (epoch_ms / 30000), pas la
-- minute de jeu → on garde DEUX snapshots par minute si le pinger tourne toutes
-- les 30 s (cf. scripts/auto-live.js --interval=30), sans collision. `minute`
-- (minute de jeu API) reste stockée pour la ligne mi-temps et la cadence.
--
-- Écritures via createAdminClient (bypass RLS) depuis le cron — aucune policy
-- insert/update volontairement (cf. match_stats / match_events).
-- Idempotent : ré-exécutable sans casse.

create table if not exists public.match_pressure (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid   not null references public.matches(id) on delete cascade,
  t           bigint not null,        -- bucket 30 s : floor(epoch_ms / 30000)
  minute      int,                    -- minute de jeu (API), pour mi-temps/label
  -- Stats CUMULÉES à cet instant : { home: {sog,shots,inbox,corners,xg,poss}, away: {...} }
  stats       jsonb  not null,
  captured_at timestamptz not null default now(),
  unique (match_id, t)
);

create index if not exists match_pressure_match_idx
  on public.match_pressure (match_id, t);

alter table public.match_pressure enable row level security;

drop policy if exists "Lecture match_pressure" on public.match_pressure;
create policy "Lecture match_pressure"
  on public.match_pressure for select to authenticated using (true);
