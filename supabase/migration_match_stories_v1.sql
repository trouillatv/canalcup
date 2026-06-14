-- ============================================================================
--  migration_match_stories_v1.sql
--  Crée la table match_stories pour stocker les commentaires IA post-match.
--  Ces phrases sont ensuite publiées dans le live cup (feed_posts type=robert).
--
--  Idempotent — peut être relancé sans danger.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.match_stories (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id   uuid NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  phrase     text NOT NULL,
  emoji      text,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_stories_match_idx ON public.match_stories (match_id);

ALTER TABLE public.match_stories ENABLE ROW LEVEL SECURITY;

-- Lecture publique pour les utilisateurs authentifiés
CREATE POLICY IF NOT EXISTS "match_stories_select"
  ON public.match_stories FOR SELECT TO authenticated USING (true);
