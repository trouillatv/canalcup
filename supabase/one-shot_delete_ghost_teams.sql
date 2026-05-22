-- Supprime les équipes "fantômes" = aucune personne rattachée (ni users.team_id,
-- ni team_memberships). Cible les 3 équipes seed babyfoot + les orphelines de
-- test, SANS toucher aux vraies équipes (binômes avec membres).
--
-- Idempotent : ré-exécutable. Les enfants NO ACTION sont supprimés d'abord
-- (sinon la suppression de teams échoue) ; team_join_requests / team_memberships
-- partent en CASCADE.
--
-- ⚠️ Destructif : supprime aussi les données de DÉMO rattachées à ces fantômes
-- (matchs babyfoot de démo, posts revivez de démo, 1 inbox). Aucune donnée de
-- vraie équipe n'est touchée (prédicat "0 membre").

-- Le même prédicat est réutilisé partout : équipes sans aucun membre.
delete from public.babyfoot_matches
where team_a_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id))
   or team_b_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.revivez_posts
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.inbox_events
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.predictions
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.bonus_predictions
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.quiz_answers
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.score_events
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.challenge_entries
where team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

delete from public.votes
where target_team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id))
   or voter_team_id in (select t.id from public.teams t where not exists (select 1 from public.users u where u.team_id=t.id) and not exists (select 1 from public.team_memberships m where m.team_id=t.id));

-- Enfin les équipes elles-mêmes (join_requests/memberships en CASCADE).
delete from public.teams t
where not exists (select 1 from public.users u where u.team_id=t.id)
  and not exists (select 1 from public.team_memberships m where m.team_id=t.id);
