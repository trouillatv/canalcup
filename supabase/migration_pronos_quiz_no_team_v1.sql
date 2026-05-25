-- Pronos + quiz sont INDIVIDUELS : on peut désormais jouer SANS équipe.
-- team_id devient optionnel (un joueur sans binôme pronostique pour son
-- classement individuel ; ça ne crédite aucune équipe). Idempotent.

alter table public.predictions  alter column team_id drop not null;
alter table public.quiz_answers  alter column team_id drop not null;
-- bonus_predictions.team_id est déjà nullable.
