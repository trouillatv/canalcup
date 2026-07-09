# Validation — Baby-foot V1 « paires ad-hoc » (identité par entrée)

Pause fonctionnelle demandée avant de construire l'UI. Vérifie que le passage de
l'identité `team_id` → `entry_id` **ne change rien** au championnat existant et
que le scoring différencié (officiel vs ad-hoc) est correct.

## Contexte du changement
- **Migration additive** : `babyfoot_entries.kind` (`official` | `open`) + `p1/p2` ;
  `team_id` nullable ; `babyfoot_matches.entry_a_id/entry_b_id` (+ backfill) ;
  tables `partner_requests` / `seeking` ; trigger « 1 joueur = 1 inscription ».
- **Moteur** : génération / planning / classement / awards / Jour J s'appuient
  sur `entry_id`. `team_a_id/team_b_id` conservés pour les libellés/stats des
  officiels. **L'algorithme n'est pas réécrit** — seule l'identité des
  participants change.

## Pourquoi « Top 4 identique à l'ancien moteur »
Le tri du classement est **inchangé** (victoires → diff → BP → confrontation
directe → ordre stable). Pour un binôme officiel, `entry_id` ↔ `team_id` est une
bijection : l'ordre produit est donc identique à l'ancien moteur. Le seul cas
nouveau (paire ad-hoc) n'a pas de `team_id` mais possède un `entry_id`, ce que
l'ancien moteur ne savait pas représenter.

## Scénarios exécutés (éditions jetables, prod non touchée)

### A — 12 binômes officiels (aucune paire ad-hoc)
| Vérification | Résultat |
|---|---|
| Top 4 = les 4 meilleurs seeds | ✅ |
| Tous les qualifiés jouent 3 matchs | ✅ |
| Demi-finales = 1ᵉ–4ᵉ et 2ᵉ–3ᵉ (par rang) | ✅ `[[1,4],[2,3]]` |
| Champion = 65 pts | ✅ |
| Officiels : `team_id` présent sur les awards → **points ÉQUIPE** | ✅ |

### B — 10 officiels + 2 paires ad-hoc
| Vérification | Résultat |
|---|---|
| Top 4 = les 4 meilleurs seeds | ✅ |
| Demi-finales = 1ᵉ–4ᵉ et 2ᵉ–3ᵉ (par rang) | ✅ `[[1,4],[2,3]]` |
| Champion = 65 pts | ✅ |
| Officiels : `team_id` présent → **points ÉQUIPE** | ✅ |
| Ad-hoc : `team_id` **NULL** sur tous les awards → **0 point ÉQUIPE** | ✅ |
| Ad-hoc : points > 0 → **crédit INDIVIDUEL** des 2 joueurs | ✅ |

## Bug trouvé & corrigé par cette validation
`babyfoot_awards.team_id` était `NOT NULL`. Une paire ad-hoc (team_id NULL) faisait
**échouer l'insertion en bloc** de `recomputeAwards` → aucun award créé dès qu'une
paire ad-hoc était présente. **Correctif** : migration
`20260709150000_babyfoot_awards_team_nullable.sql` (colonne rendue nullable).

## Règles de scoring confirmées
- **Binôme officiel** : `recomputeAwards` écrit les awards avec `team_id` = équipe RSE.
  `computeTeamScores` les somme → **points équipe** ; `getIndividualLeaderboard`
  crédite les **2 membres** en individuel. (Comportement historique inchangé.)
- **Paire ad-hoc** : awards avec `team_id` NULL → `computeTeamScores` les **ignore**
  (aucun point équipe). `openBabyfootPointsByUser` crédite `p1` et `p2` en
  **individuel** (via `entry_id`). L'appoint « déjà engagé » n'existe pas en V1
  (règle 1 joueur = 1 inscription, garantie par le trigger).

### C — Règle « RENFORT » (10 officiels + 1 ad-hoc normale + 1 ad-hoc avec renfort)
Règle produit : une personne seule (p1) peut jouer avec un collègue DÉJÀ inscrit
ailleurs (p2, renfort). Affichage « Vincent + Jeff en renfort » ; seul p1 marque
(individuel) ; le renfort ne gagne rien ; aucun point équipe ; le binôme officiel
du renfort reste intact.

| Vérification | Résultat |
|---|---|
| Trigger BLOQUE p2 déjà engagé quand `p2_is_helper=false` | ✅ |
| Trigger AUTORISE p2 déjà engagé quand `p2_is_helper=true` | ✅ |
| Libellé = « X + Y en renfort » | ✅ |
| Paire renfort : points au tournoi > 0, `team_id` NULL (0 pt équipe) | ✅ |
| Binôme officiel du renfort : awards intacts (points équipe préservés) | ✅ |
| p1 crédité en individuel ; renfort **non crédité** | ✅ |
| Paire ad-hoc normale : les **2** joueurs crédités | ✅ |

Migration : `20260709170000_babyfoot_helper.sql` (`p2_is_helper` + trigger revu —
le renfort ne « consomme » pas d'engagement ; la règle « 1 joueur = 1 inscription »
s'applique aux joueurs RÉELS).

## Reste à construire (UI, non risqué)
- API `/api/babyfoot/partner` (candidats + statut, demande/accept/refuse, croisées, 🔎).
- Refonte `/babyfoot/register` (3 modes) + éditeur de dispos de la paire créée.
- Splash « demande de partenaire » (Accepter / Refuser).
- **Libellés** : ne jamais montrer `official`/`open`. Officiel → « Nom d'équipe /
  Joueur & Joueur » ; ad-hoc → « Joueur & Joueur *(Paire Baby-foot)* ».
