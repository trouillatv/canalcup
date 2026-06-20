-- ============================================================================
--  migration_player_match_stats_preserve_v1.sql
--  Protège les données joueur contre l'écrasement par NULL lors d'un resync.
--
--  Problème : syncPlayerStatsApiF fait un UPSERT. En cours de match, API-Football
--  renvoie souvent rating=null (notes publiées plus tard). Un resync pouvait donc
--  ÉCRASER une note déjà obtenue par null → la note « disparaissait ».
--
--  Règle : sur UPDATE, si la nouvelle valeur est NULL on conserve l'ancienne
--  (rating, minutes, started, duels_won, key_passes). Les compteurs (buts, passes,
--  cartons, tirs…) ne sont jamais null (défaut 0) et restent librement mis à jour.
--  Idempotent.
-- ============================================================================

create or replace function public.preserve_player_match_stats_nonnull()
returns trigger language plpgsql as $$
begin
  if new.rating     is null then new.rating     := old.rating;     end if;
  if new.minutes    is null then new.minutes    := old.minutes;    end if;
  if new.started    is null then new.started    := old.started;    end if;
  if new.duels_won  is null then new.duels_won  := old.duels_won;  end if;
  if new.key_passes is null then new.key_passes := old.key_passes; end if;
  return new;
end $$;

drop trigger if exists trg_preserve_player_match_stats on public.player_match_stats;
create trigger trg_preserve_player_match_stats
  before update on public.player_match_stats
  for each row execute function public.preserve_player_match_stats_nonnull();
