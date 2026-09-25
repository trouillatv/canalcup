# Stratégie Supabase — bootstrap CANAL Sports (P1)

Statut : **historique (P1)**. La question "combien de bases Supabase ?"
et le bootstrap effectif sont maintenant tranchés et exécutés — voir
`docs/supabase-architecture-p2.md`. Ce document reste la référence pour
*quelles tables* recréer (tableau ci-dessous, toujours valable) ; il ne
décrit plus l'état d'exécution réel.

## Décisions actées

1. **Pas de migration de la base historique Canal Cup.** Le nouveau
   produit démarre avec un schéma neuf. Seule `users`/`allowlist_users`
   avait été identifiée dans l'audit comme candidate à une migration de
   *données* (pas de schéma) — décision reportée à P2 (elle dépend de qui
   doit avoir un compte dans CANAL Sports dès le lancement).
2. **Un seul système de migrations à partir de maintenant : le dossier
   `supabase/migrations/` au format CLI (timestamp + nom), appliqué via
   `supabase db push` / Management API.** Le système parallèle
   `supabase/migration_*.sql` + `scripts/migrate.js` (49 fichiers non
   timestampés, appliqués à la main) est abandonné pour le nouveau projet.
   Il reste tel quel dans l'historique Canal Cup — ne pas y toucher.
3. **Aucun `one-shot_*.sql` copié.** Ces ~20 scripts ciblent des lignes
   précises (un user, une équipe de test) de la base Canal Cup — aucune
   valeur pour un nouveau projet.

## Tables techniques génériques — vérifiées une à une, pas supposées

Le prompt initial listait `users, push_subscriptions, inbox_events/
notifications, cron_runs, feedback, app_settings` comme candidates. Après
lecture réelle du schéma (pas une supposition sur le nom) :

| Table | Verdict | Détail |
|---|---|---|
| `push_subscriptions` | **Reprendre telle quelle** | Référence `auth.users(id)` directement (pas `public.users`). Aucun couplage Canal Cup. RLS déjà correcte (`auth.uid() = user_id`). |
| `app_settings` | **Reprendre la structure, pas les lignes** | `key text PRIMARY KEY, value jsonb` — générique. Mais actuellement seedée avec des clés Canal Cup (`banner_text: "Bienvenue sur Canal Cup 2026"`, `match_of_week_id`…). Recréer la table vide, ne pas copier le seed. |
| `cron_runs` | **Reprendre telle quelle** | Log générique (start/finish/status/error_message/meta) utilisé par `lib/monitoring/cron-log.ts`, aucune colonne sport-spécifique. |
| `feedback` | **Reprendre la structure** | Référence `public.users(id)` — donc dépend de la table `users` du nouveau projet, pas de la base Canal Cup. Aucune donnée à migrer (retours liés au jeu terminé). |
| `inbox_events` | **Reprendre la structure, revoir `team_id`** | Colonne `team_id` optionnelle qui référence le concept "binôme" Canal Cup — la garder nullable mais ne pas la considérer comme centrale dans le nouveau modèle de notifications. |
| `users` | **Ne PAS copier tel quel — reshape nécessaire** | La table actuelle a `football_level: FootballLevel` en colonne **non-optionnelle dans le type**, et un `team_id`/`team_role` couplés au modèle binôme. Le nouveau schéma doit rendre ces deux champs optionnels/absents dès la création de la table (cohérent avec le déblocage déjà fait dans `middleware.ts`, voir P1-G). Ne pas répliquer `football_level NOT NULL`. |

Conclusion : **aucune table n'a été copiée "parce que son nom sonnait
générique" sans vérification** — c'était explicitement la consigne. Deux
des six candidates (`app_settings`, `inbox_events`) nécessitent un nettoyage
avant réutilisation ; une (`users`) nécessite une vraie refonte de schéma,
pas une copie.

## Ce qui reste à faire (hors P1)

- ~~Écrire la première migration... sur le nouveau projet Supabase~~ —
  **fait en P2**, voir `docs/supabase-architecture-p2.md` (bootstrap
  appliqué au projet `yfhuqsuboqfznnpceosl`, organisation
  `vjasdstjdszsekbwazbi`).
- Décider si `allowlist_users` (contrôle d'accès par email/domaine) est
  repris tel quel — probable, car indépendant du jeu — à confirmer en P2.
- Le modèle Sport/Competition/Season/Event (voir
  `docs/adr/0001-multi-sport-data-model.md`) n'est PAS dans ce bootstrap :
  il arrive avec P2.
