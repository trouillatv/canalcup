-- Quiz « rythme auto » : le quiz s'enchaîne tout seul (plus de clic « question
-- suivante »). Le serveur avance le rythme à partir du temps (countdown →
-- question → temps écoulé → bonne réponse → question suivante).
--
-- L'organisateur (Vincent) ne pilote plus chaque étape : sa seule commande de
-- rythme est PAUSE / REPRENDRE. On persiste l'instant de mise en pause pour que
-- la TV, les téléphones et la télécommande gèlent tous au même point, puis
-- reprennent exactement là où ils s'étaient arrêtés (started_at est décalé de la
-- durée de pause au moment du « Reprendre »).
--
--   paused_at NULL      → le quiz tourne (rythme dérivé du temps)
--   paused_at = instant  → figé à cet instant ; aucun avancement auto

alter table public.quiz_session
  add column if not exists paused_at timestamptz;
