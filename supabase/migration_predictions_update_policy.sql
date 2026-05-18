-- ============================================================================
--  migration_predictions_update_policy.sql
--  FIX : les pronostics ne se sauvegardaient pas quand on les MODIFIAIT.
--
--  /api/predictions fait un upsert (onConflict user_id,match_id) sur la table
--  predictions (unique(user_id,match_id)). RLS avait SELECT + INSERT mais
--  AUCUNE policy UPDATE → la branche UPDATE de l'upsert (re-pronostic) était
--  refusée par RLS → échec silencieux ("résultats ne se sauvent pas").
--
--  On autorise chaque utilisateur à modifier UNIQUEMENT ses propres pronos.
--  Idempotent. À exécuter dans le SQL editor Supabase (ou via Management API).
-- ============================================================================

drop policy if exists "Update predictions" on public.predictions;
create policy "Update predictions" on public.predictions
  for update to authenticated
  using      (user_id in (select id from public.users where auth_id = auth.uid()))
  with check (user_id in (select id from public.users where auth_id = auth.uid()));

-- ============================================================================
--  Fin migration_predictions_update_policy.sql
-- ============================================================================
