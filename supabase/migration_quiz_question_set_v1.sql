-- Quiz : chaque session tire un SOUS-ENSEMBLE aléatoire de questions (par défaut
-- 60), dans un ordre aléatoire, au lieu de poser TOUTES les questions dans
-- l'ordre d'insertion. La liste tirée (ids ordonnés) est persistée ici pour que
-- la TV, les téléphones et la télécommande suivent EXACTEMENT le même parcours.
-- L'organisateur peut en rajouter en cours (action "extend") ou terminer. Le
-- classement porte sur le nombre réellement posé (= questions répondues).
--
--   question_ids = ["<uuid>", "<uuid>", …] (ordre de passage) ; NULL avant start
--   ou pour les anciennes sessions (fallback : toutes les questions).

alter table public.quiz_session
  add column if not exists question_ids jsonb;
