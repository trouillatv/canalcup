-- Diagnostic état équipe de Vincent (trouillatv@gmail.com)
-- pour comprendre pourquoi 'rejoindre une équipe' échoue.
select
  -- 1. Ses memberships actuels
  (select json_agg(json_build_object(
    'team_id', tm.team_id,
    'team_name', t.name,
    'role', tm.role,
    'is_primary', tm.is_primary
  ))
   from public.team_memberships tm
   join public.teams t on t.id = tm.team_id
   where tm.user_id = (select id from public.users where email = 'trouillatv@gmail.com')
  ) as memberships,
  -- 2. Ses demandes pending sortantes
  (select json_agg(json_build_object(
    'request_id', tjr.id,
    'team_id', tjr.team_id,
    'team_name', t.name,
    'status', tjr.status,
    'created_at', tjr.created_at
  ))
   from public.team_join_requests tjr
   join public.teams t on t.id = tjr.team_id
   where tjr.user_id = (select id from public.users where email = 'trouillatv@gmail.com')
  ) as join_requests,
  -- 3. Toutes les équipes existantes (pour voir les codes)
  (select json_agg(json_build_object(
    'id', t.id,
    'name', t.name,
    'invite_code', t.invite_code,
    'members_count', (select count(*) from public.team_memberships where team_id = t.id)
  ))
   from public.teams t
  ) as all_teams;
