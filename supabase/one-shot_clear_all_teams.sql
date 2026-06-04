-- one-shot_clear_all_teams
-- Vide toutes les equipes Canal Cup sans supprimer les utilisateurs.
--
-- Preserve les donnees detachables en mettant team_id a null.
-- Supprime les donnees qui n'ont pas de sens sans equipe ou dont la FK est
-- NOT NULL (babyfoot, votes, score_events, participations d'animations).

begin;

-- Detacher les profils et donnees historiques conservables.
update public.users
set team_id = null,
    team_role = 'member'
where team_id is not null;

update public.predictions
set team_id = null
where team_id is not null;

update public.quiz_answers
set team_id = null
where team_id is not null;

update public.bonus_predictions
set team_id = null
where team_id is not null;

update public.inbox_events
set team_id = null
where team_id is not null;

update public.revivez_posts
set team_id = null
where team_id is not null;

update public.votes
set target_team_id = null
where target_team_id is not null;

-- Supprimer ce qui depend obligatoirement d'une equipe.
delete from public.team_join_requests;
delete from public.team_memberships;
delete from public.challenge_entries;
delete from public.score_events;
delete from public.votes;
delete from public.babyfoot_matches;

-- Supprimer toutes les equipes.
delete from public.teams;

commit;

select
  (select count(*) from public.teams) as teams_remaining,
  (select count(*) from public.users where team_id is not null) as users_with_team,
  (select count(*) from public.team_memberships) as memberships_remaining,
  (select count(*) from public.team_join_requests) as join_requests_remaining;
