-- Déduplication des push "match start" : une ligne par match déjà notifié.
-- INSERT ... ON CONFLICT DO NOTHING → 0 rows affected = déjà envoyé, skip.
create table if not exists match_push_log (
  match_id  text primary key,
  sent_at   timestamptz not null default now()
);
