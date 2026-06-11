-- ============================================================================
--  migration_predictions_updated_at_v1.sql
--  SYMPTÔME : "Could not find the 'updated_at' column of 'predictions'
--             in the schema cache" lors du upsert d'un pronostic.
--
--  CAUSE : PostgREST / un trigger tiers attend updated_at sur la table
--          predictions, mais la colonne n'existe pas dans le schéma initial.
--
--  FIX :
--   1. Ajoute la colonne updated_at (backfill = created_at pour l'existant).
--   2. Crée le trigger pour l'auto-mettre à jour à chaque UPDATE.
--   3. Recharge le schema cache PostgREST (voir commentaire en bas).
--
--  Idempotent — peut être relancé sans danger.
-- ============================================================================

-- 1. Colonne
ALTER TABLE public.predictions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Backfill les lignes existantes avec created_at
UPDATE public.predictions
SET updated_at = created_at
WHERE updated_at = now() AND created_at < now() - INTERVAL '1 second';

-- 2. Fonction trigger générique (réutilisable)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 3. Trigger sur predictions
DROP TRIGGER IF EXISTS trg_predictions_updated_at ON public.predictions;
CREATE TRIGGER trg_predictions_updated_at
  BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- APRÈS EXÉCUTION : recharger le schema cache PostgREST depuis le dashboard
-- Supabase → Settings → API → "Reload schema cache"
-- Ou via l'API REST :
--   curl -X POST https://<project-ref>.supabase.co/rest/v1/reload_schema \
--        -H "apikey: <service-role-key>"
-- ============================================================================
