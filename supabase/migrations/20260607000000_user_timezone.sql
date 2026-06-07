-- Fuseau horaire par utilisateur.
--
-- Les abonnés Canal+ sont répartis sur des territoires Pacifique aux
-- fuseaux très différents : Nouvelle-Calédonie et Vanuatu en UTC+11,
-- Polynésie française (Tahiti) en UTC-10 — soit 21 h d'écart. Les
-- horaires de match sont stockés en instant absolu (starts_at, UTC) ;
-- cette colonne sert UNIQUEMENT à l'affichage : chaque user voit l'heure
-- des matchs dans SON fuseau. Aucun de ces territoires n'observe d'heure
-- d'été, donc les offsets sont fixes.
--
-- Défaut = Pacific/Noumea (siège de l'événement / écrans TV du lieu).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Pacific/Noumea';
