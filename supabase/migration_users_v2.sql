-- ============================================================
-- Canal Cup 2026 — MIGRATION v2
-- Copie-colle dans Supabase SQL Editor et clique Run
-- Idempotent : peut être relancé sans risque
-- ============================================================

-- ─── 1. public.users — colonnes manquantes ───────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name    text,
  ADD COLUMN IF NOT EXISTS user_slug       text UNIQUE,
  ADD COLUMN IF NOT EXISTS team_role       text NOT NULL DEFAULT 'member'
    CHECK (team_role IN ('captain', 'member')),
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0;

-- ─── 2. public.teams — couleur équipe ────────────────────────

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#FFD700';

-- ─── 3. public.services — colonne emoji ──────────────────────

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '';

UPDATE public.services SET emoji = '💻' WHERE name = 'SI';
UPDATE public.services SET emoji = '🎧' WHERE name = 'CRC';
UPDATE public.services SET emoji = '🛍️' WHERE name = 'Boutique';
UPDATE public.services SET emoji = '🤝' WHERE name = 'Ventes Directes';
UPDATE public.services SET emoji = '📣' WHERE name = 'Marketing';
UPDATE public.services SET emoji = '🧾' WHERE name = 'Comptabilité';
UPDATE public.services SET emoji = '🛠️' WHERE name = 'Technique';
UPDATE public.services SET emoji = '⭐' WHERE name = 'Direction';
UPDATE public.services SET emoji = '👥' WHERE name = 'Autre';

-- ─── 4. allowlist_users — ajout rôle event_admin ─────────────

ALTER TABLE public.allowlist_users
  DROP CONSTRAINT IF EXISTS allowlist_users_role_check;

ALTER TABLE public.allowlist_users
  ADD CONSTRAINT allowlist_users_role_check
  CHECK (role IN ('user', 'admin', 'event_admin', 'super_admin'));

-- ─── 5. admin_logs — structure complète ──────────────────────

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email     text NOT NULL,
  action          text NOT NULL,
  target_email    text,
  metadata        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_logs: lecture admins" ON public.admin_logs;
CREATE POLICY "admin_logs: lecture admins"
  ON public.admin_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowlist_users
      WHERE email = auth.email()
        AND role IN ('admin', 'super_admin')
        AND is_active = true
    )
  );

-- ─── 6. ai_cost_logs — structure complète ────────────────────

CREATE TABLE IF NOT EXISTS public.ai_cost_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature             text NOT NULL,
  model               text NOT NULL DEFAULT 'gemini-2.0-flash',
  tokens              int NOT NULL DEFAULT 0,
  estimated_cost_eur  numeric(10, 6) NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_cost_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_cost_logs: lecture admins" ON public.ai_cost_logs;
CREATE POLICY "ai_cost_logs: lecture admins"
  ON public.ai_cost_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.allowlist_users
      WHERE email = auth.email()
        AND role IN ('admin', 'super_admin')
        AND is_active = true
    )
  );

-- ─── 7. app_settings — structure complète ────────────────────

CREATE TABLE IF NOT EXISTS public.app_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings: lecture" ON public.app_settings;
CREATE POLICY "app_settings: lecture"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Seed settings de base
INSERT INTO public.app_settings (key, value) VALUES
  ('match_of_week_id',  'null'),
  ('banner_text',       '"Bienvenue sur Canal Cup 2026 ! ⚽"'),
  ('maintenance_mode',  'false'),
  ('chaos_mode',        'false'),
  ('tournament_phase',  '"group_stage"')
ON CONFLICT (key) DO NOTHING;

-- ─── 8. Trigger : auto-créer profil users à la 1ère connexion ─

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (auth_id, name, email)
  VALUES (NEW.id, split_part(NEW.email, '@', 1), NEW.email)
  ON CONFLICT (email) DO UPDATE
    SET auth_id = EXCLUDED.auth_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── 9. RLS services — lecture pour authentifiés ─────────────

-- (La table services existe déjà, on s'assure que RLS est ok)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "services: lecture" ON public.services;
CREATE POLICY "services: lecture"
  ON public.services FOR SELECT TO authenticated USING (true);

-- ─── 10. Vérification finale ──────────────────────────────────

-- Après exécution, vérifier dans Table Editor que :
-- users         → colonnes display_name, user_slug, team_role, onboarding_step présentes
-- teams         → colonne color présente
-- services      → colonne emoji présente, 9 lignes avec emojis
-- allowlist_users → role peut valoir event_admin
-- admin_logs    → table vide, prête
-- ai_cost_logs  → table vide, prête
-- app_settings  → 5 lignes de config seed
