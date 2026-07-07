-- DIAGNOSTIC (lecture seule) — déplacer pronos France & Norvège admin -> vincent
-- 1) Comptes candidats
select id, name, email, team_id from public.users
where email ilike '%trouillat%' or email ilike '%vincent%' or name ilike '%vincent%';

-- 2) Pronos sur des matchs impliquant France ou Norvège, avec le user qui les a posés
select p.id as prediction_id, u.email, u.name, p.user_id, p.team_id,
       m.id as match_id, m.team_a, m.team_b, m.starts_at, m.status,
       p.predicted_score_a, p.predicted_score_b, p.points_awarded
from public.predictions p
join public.matches m on m.id = p.match_id
join public.users u on u.id = p.user_id
where m.team_a ilike '%france%' or m.team_b ilike '%france%'
   or m.team_a ilike '%norv%' or m.team_b ilike '%norv%' or m.team_a ilike '%norway%' or m.team_b ilike '%norway%'
order by m.starts_at, u.email;
