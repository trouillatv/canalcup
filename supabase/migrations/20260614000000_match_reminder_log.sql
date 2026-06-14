-- Déduplication pour les rappels "30 min avant le match".
-- Une ligne par match garantit qu'on n'envoie qu'un seul rappel même si le cron
-- s'exécute plusieurs fois dans la fenêtre de détection.
CREATE TABLE IF NOT EXISTS match_reminder_log (
  match_id TEXT        PRIMARY KEY,
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
