-- migration_challenges_group_flags_v1
-- Toutes les animations se jouent en equipe/groupe.
-- Ajoute aussi le Grand Quiz dans la liste des animations.

alter table public.challenges
  add column if not exists allows_group boolean not null default false;

update public.challenges
set allows_group = true;

insert into public.challenges
  (slug, title, emoji, description, rules, location, duration_minutes, max_points, category, phase, status, sort_order, allows_group)
values
  (
    'grand-quiz',
    'Grand Quiz Canal Cup',
    '🧠',
    'Le grand quiz Canal Cup en equipe : questions foot, Canal+, culture generale et reflexes collectifs.',
    'Les joueurs participent en groupe. L''animateur lance les questions, valide les reponses et attribue les points via l''admin animations.',
    'Salle de projection',
    30,
    80,
    'challenges',
    1,
    'upcoming',
    55,
    true
  )
on conflict (slug) do update set
  title = excluded.title,
  emoji = excluded.emoji,
  description = excluded.description,
  rules = excluded.rules,
  location = excluded.location,
  duration_minutes = excluded.duration_minutes,
  max_points = excluded.max_points,
  category = excluded.category,
  phase = excluded.phase,
  status = case
    when public.challenges.status = 'hidden' then public.challenges.status
    else excluded.status
  end,
  sort_order = excluded.sort_order,
  allows_group = true;
