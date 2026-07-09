-- ============================================================================
-- Baby-foot : « page binôme » + traçabilité des créneaux.
--
-- Deux notions désormais DISTINCTES dans l'expérience :
--   1) l'INSCRIPTION officielle (qui joue avec qui, qui l'a créée, ses créneaux) ;
--   2) le rôle éventuel de RENFORT (dépanner un autre joueur) — déjà porté par
--      p2_is_helper, inchangé ici.
--
-- Ce qui change en base :
--   · babyfoot_entries.slots_updated_by / slots_updated_at : QUI a saisi/modifié
--     les disponibilités en dernier (registered_by = créateur de l'inscription ;
--     slots_updated_by = dernier éditeur). Permet d'afficher « créneaux
--     sélectionnés par Vincent » et de notifier le binôme à chaque modification.
--   · inbox_events.type accepte 'babyfoot' : courrier « Julien a modifié les
--     créneaux du binôme » envoyé au coéquipier.
--
-- ADDITIF & idempotent. Moteur de scoring / tirage inchangés.
-- ============================================================================

begin;

-- 1) Traçabilité de la saisie des créneaux.
alter table public.babyfoot_entries
  add column if not exists slots_updated_by uuid references public.users(id) on delete set null,
  add column if not exists slots_updated_at timestamptz;

-- Backfill : les inscriptions existantes ont été saisies par leur créateur.
update public.babyfoot_entries
  set slots_updated_by = registered_by
  where slots_updated_by is null and registered_by is not null;

-- 2) inbox_events : nouveau type 'babyfoot' (notifications de binôme).
do $$
begin
  alter table public.inbox_events drop constraint if exists inbox_events_type_check;
  alter table public.inbox_events
    add constraint inbox_events_type_check
    check (type in ('mention', 'vote_received', 'badge', 'matinale', 'roast', 'babyfoot'));
end $$;

commit;
