-- ============================================================================
--  migration_match_comments_replies_v1.sql
--  Réponses aux commentaires de match (threading 1 niveau). parent_comment_id
--  pointe vers le commentaire auquel on répond ; l'auteur du parent reçoit un
--  push « X a répondu à ton commentaire ». Idempotent.
-- ============================================================================

alter table public.match_comments
  add column if not exists parent_comment_id uuid references public.match_comments(id) on delete set null;

create index if not exists match_comments_parent_idx
  on public.match_comments (parent_comment_id);
