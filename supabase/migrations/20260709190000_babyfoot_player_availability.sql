-- ============================================================================
-- Baby-foot : disponibilités PAR JOUEUR (fini le « dernier qui édite gagne »).
--
-- Problème résolu : les créneaux étaient stockés au niveau du BINÔME
-- (babyfoot_entry_availability). Si Vincent cochait 3 créneaux puis Julien
-- rouvrait l'app et changeait tout, les créneaux de Vincent disparaissaient.
--
-- Nouveau modèle : chaque joueur renseigne SES propres disponibilités
-- (babyfoot_player_availability). L'app calcule automatiquement les créneaux
-- COMMUNS (intersection) — c'est ce dont a besoin le tirage (les 2 doivent
-- jouer ensemble). babyfoot_entry_availability devient DÉRIVÉE (= intersection)
-- et reste la seule source lue par le moteur (tirage, planning, santé, admin) :
-- AUCUN changement moteur.
--
-- Règle d'intersection : seuls les joueurs qui ONT renseigné des créneaux
-- « contraignent ». Tant qu'un coéquipier n'a rien saisi, il est considéré
-- disponible partout (l'inscription d'un seul joueur reste possible, comme
-- avant). Dès qu'il saisit, l'effectif = intersection des deux.
--
-- Renfort (p2_is_helper) : ses dispos ne concernent pas cette paire (elles
-- appartiennent à son binôme officiel) → seul p1 contraint la paire ad-hoc.
--
-- ADDITIF & idempotent.
-- ============================================================================

begin;

-- 1) Disponibilités individuelles (par joueur, au sein d'une inscription).
create table if not exists public.babyfoot_player_availability (
  entry_id uuid not null references public.babyfoot_entries(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  slot_key text not null,
  created_at timestamptz not null default now(),
  primary key (entry_id, user_id, slot_key)
);
create index if not exists idx_bf_player_avail_entry on public.babyfoot_player_availability(entry_id);
create index if not exists idx_bf_player_avail_user on public.babyfoot_player_availability(user_id);

alter table public.babyfoot_player_availability enable row level security;
drop policy if exists babyfoot_player_avail_read on public.babyfoot_player_availability;
create policy babyfoot_player_avail_read on public.babyfoot_player_availability
  for select to authenticated using (true);

-- 2) Backfill : les dispos actuelles de chaque inscription deviennent les
--    dispos INDIVIDUELLES de chacun de ses joueurs RÉELS → intersection
--    identique à l'existant (zéro régression pour les binômes déjà inscrits).
insert into public.babyfoot_player_availability (entry_id, user_id, slot_key)
select ea.entry_id, pl.user_id, ea.slot_key
from public.babyfoot_entry_availability ea
join public.babyfoot_entries e on e.id = ea.entry_id
join lateral (
  -- Joueurs réels de l'inscription.
  select tm.user_id
    from public.team_memberships tm
   where e.kind = 'official' and tm.team_id = e.team_id
  union
  select e.p1_user_id
   where e.kind = 'open' and e.p1_user_id is not null
  union
  select e.p2_user_id
   where e.kind = 'open' and coalesce(e.p2_is_helper, false) = false and e.p2_user_id is not null
) pl(user_id) on pl.user_id is not null
on conflict do nothing;

commit;
