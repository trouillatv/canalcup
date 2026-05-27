-- Ajoute matches.finished_at : horodatage du coup de sifflet final, rempli UNE
-- SEULE FOIS par le resync quand l'API rapporte le statut "finished" (cf.
-- stampFinishedAt dans services/football/sync.ts). Sert de point de départ à la
-- fenêtre "Terminé" du flash (breaking-news). Jamais déplacé ensuite ; reste
-- null pour les matchs importés déjà terminés (pas de coup de sifflet observé).
alter table public.matches add column if not exists finished_at timestamptz;
