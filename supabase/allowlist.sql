-- Table allowlist_users : contrôle d'accès à Canal Cup
-- À exécuter dans Supabase SQL Editor

CREATE TABLE IF NOT EXISTS allowlist_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE allowlist_users ENABLE ROW LEVEL SECURITY;

-- Un utilisateur connecté peut lire sa propre ligne (pour vérifier son rôle)
CREATE POLICY "allowlist: read own row"
  ON allowlist_users FOR SELECT
  USING (email = auth.email());

-- Seul le service_role peut insérer/modifier (opérations admin)
-- (pas de policy INSERT/UPDATE/DELETE pour anon/authenticated)

-- Seed : super admin
INSERT INTO allowlist_users (email, role)
VALUES ('trouillatv@gmail.com', 'super_admin')
ON CONFLICT (email) DO NOTHING;
