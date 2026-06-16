-- migration_quiz_session_rls_v1
-- Correctif advisor Supabase « rls_disabled_in_public » : la table
-- public.quiz_session avait été créée (migration_quiz_session_v1) sans
-- activer RLS — donc lisible/modifiable via l'anon key.
--
-- Cette table est 100 % gérée côté serveur : tous les accès passent par
-- le service-role (createAdminClient), jamais par le client navigateur.
-- Aucune souscription realtime ne la cible (le live quiz poll /api/quiz/session).
-- On active donc RLS sans policy permissive : le service-role continue de
-- bypasser RLS (attribut BYPASSRLS), et anon/authenticated se retrouvent
-- en deny-all.

begin;

alter table public.quiz_session enable row level security;

commit;
