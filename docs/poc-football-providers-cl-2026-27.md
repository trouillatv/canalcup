# POC — fournisseurs de données football pour la Ligue des Champions 2026/27

Statut : **tranché — Décision A actée par l'utilisateur le 2026-09-25.**
football-data.org (plan Free) est le provider football par défaut du MVP
CANAL Sports ; API-Football reste un adapter disponible mais non actif
(compte suspendu, non bloquant pour le V1). Voir
`docs/adr/0003-sport-provider-abstraction.md`, section "Décision A", pour
le détail exécutoire (périmètre `V1_FOOTBALL_CAPABILITIES`, mécanisme
`getActiveFootballProvider()`). Ce document reste la trace des faits
vérifiés qui ont motivé la décision — la section "Conclusion — A/B/C/D"
ci-dessous est conservée telle quelle pour l'historique du raisonnement,
mais n'est plus une question ouverte : la réponse retenue est **A**.

**Règle appliquée** : une capability n'est jamais déduite de la
documentation. Si elle n'a pas été testée avec un vrai appel réseau, elle
est marquée **NON TESTÉ** — jamais AVAILABLE par supposition.

**Aucune clé souscrite, aucune dépense engagée.** Scripts (lecture
seule) :
- `scripts/poc-football-providers-cl.ts` — checks bruts par appel HTTP direct.
- `scripts/poc-verify-adapter.ts` — vérifie que l'adapter
  `lib/providers/football-data-org.ts` (pas juste l'API brute) produit
  des DTOs cohérents à partir des vraies réponses.

Exécutés le 2026-09-25 avec une clé football-data.org régénérée par
l'utilisateur (l'ancienne, exposée par accident dans une capture
partagée deux fois, n'a jamais été utilisée par ce code — seule la
nouvelle clé, ajoutée directement dans `.env.local`, a servi aux appels
ci-dessous).

## football-data.org (plan Free) — résultats réels

| Check | Verdict | Détail observé |
|---|---|---|
| Competition found (CL) | **AVAILABLE** | `GET /v4/competitions/CL` → `id=2001, name="UEFA Champions League"` |
| Full calendar | **AVAILABLE** | 144 matchs renvoyés pour la saison 2026-2027 (`season.id=2557`) en un seul appel `/matches` |
| Matchdays/rounds | **AVAILABLE** | 144/144 matchs ont `stage`/`matchday` renseignés. Matchdays observés : 1 à 8 (`stage=LEAGUE_STAGE`, format ligue à 36 équipes, cohérent avec le format réel CL depuis 2024/25) |
| Teams | **AVAILABLE** | 36 équipes renvoyées par `/teams` |
| Logos | **AVAILABLE** | Champ `crest` présent pour les équipes testées (ex. `https://crests.football-data.org/4.png`) |
| Dates/times | **AVAILABLE** | `utcDate` ISO 8601 présent sur tous les matchs (ex. `2026-09-08T16:45:00Z`) |
| Status | **AVAILABLE** | Statuts observés dans la réponse réelle : `FINISHED`, `TIMED` (aucun `IN_PLAY`/`POSTPONED` au moment du test) |
| Scores | **AVAILABLE** | Exemple réel : Club Brugge KV 2–3 Aston Villa FC (`score.fullTime`) |
| Standings | **AVAILABLE** | `/standings` renvoie 1 table (`type=TOTAL`) — cohérent avec le format ligue unique (pas de groupes) de la CL actuelle |
| Scorers/events (buts, cartons, minute) | **UNAVAILABLE** | Aucun champ de ce type dans `/matches` ; aucun endpoint dédié type `/matches/{id}/events` trouvé sur le plan Free |
| Lineups | **UNAVAILABLE** | Aucun champ lineup observé, aucun endpoint dédié trouvé |
| Match stats | **UNAVAILABLE** | Aucun champ statistics observé, aucun endpoint dédié trouvé |
| Live | **NON TESTÉ** | Aucun match `IN_PLAY` au moment du test (entre deux journées) — la fraîcheur temps réel n'a pas pu être mesurée, seul le quota (10 req/min) suggère qu'un polling toutes les 30-60s serait possible sans dépasser la limite |
| Quota limits | **AVAILABLE (mesuré)** | Headers réels : `x-requests-available-minute` (décrémente à chaque appel), `x-requestcounter-reset` (secondes avant reset, ex. `12`). Confirme un plan Free à **10 requêtes/minute**, fenêtre glissante — pas de cap journalier documenté observé |
| Observed freshness | **NON TESTÉ** | Nécessite deux appels espacés pendant un match en direct — hors scope d'un test ponctuel un jour sans match |

### Vérification de l'adapter (`FootballDataOrgProvider`) face aux payloads réels

`scripts/poc-verify-adapter.ts` a appelé les vraies méthodes de l'adapter
(pas des requêtes brutes) :

- `getCompetitions()` → 1 compétition, DTO conforme.
- `getSeasons("2001")` → 47 saisons renvoyées (1980 à 2027), DTO conforme
  — **note** : l'endpoint `/competitions/CL` renvoie tout l'historique
  des saisons, pas seulement la courante ; l'adapter ne filtre pas
  aujourd'hui, à garder en tête pour une future couche d'ingestion (pas
  un bug, juste un volume à filtrer si besoin).
- `getParticipants("2557")` → 36 participants, DTO conforme (ex.
  Borussia Dortmund, `country: "Germany"`, `logo_url` renseigné).
- `getEvents("2557")` → 144 events, DTOs `finished` et `scheduled`
  conformes à `ProviderEvent` (voir exemples réels dans la sortie du
  script), `result` correctement absent sur les matchs non joués.
- `getStandings("2557")` → 1 groupe, lignes conformes à
  `ProviderStandingRow`.
- **Cohérence croisée vérifiée par code, pas visuellement** : 0 référence
  orpheline entre `event_participants[].participant_external_id` et les
  `external_id` de `getParticipants()` (144 matchs × 2 équipes), et 0
  référence orpheline entre les lignes de `getStandings()` et les mêmes
  participants. La paire `(source, external_id)` est donc bien exploitable
  telle quelle pour un futur upsert `ON CONFLICT (source, external_id)`
  sans étape de réconciliation supplémentaire.

Aucun bug trouvé dans l'adapter face aux vraies données ; aucun correctif
nécessaire.

### Estimation de consommation de quota pour l'usage CANAL Sports

Plan Free confirmé : **10 requêtes/minute** (mesuré via les headers
`x-requests-available-minute`/`x-requestcounter-reset`, pas de cap
journalier explicite rencontré).

Un cycle de synchronisation complet de la Ligue des Champions (tel
qu'exercé par le POC) = **5 appels** : compétition, saisons, équipes,
calendrier complet (144 matchs en un seul appel, pas de pagination),
classement. Ordres de grandeur :

- **Rafraîchissement quotidien** (hors jour de match) : 5 appels/jour —
  très largement sous la limite.
- **Jour de match, polling toutes les 5 minutes** sur la journée (12
  cycles/heure × quelques heures) : reste sous 10 req/min tant que les 5
  appels d'un cycle ne sont pas envoyés en rafale — à espacer côté
  ingestion (pas de contrainte technique bloquante, juste une discipline
  d'implémentation à respecter plus tard).
- Le calendrier complet de la saison (144 matchs) est obtenu en un seul
  appel `/matches` — pas besoin d'un appel par match, ce qui limite
  fortement le volume total même en cas de sync fréquente.

**Conclusion quota : le plan Free suffit très largement pour un usage
"un seul tournoi, une seule saison" comme le MVP Champions League**, y
compris avec un polling raisonnable les jours de match.

## API-Football (plan Free) — toujours bloqué

Compte associé à `API_FOOTBALL_KEY` dans `.env.local` : **toujours
suspendu**, reconfirmé une nouvelle fois via `GET /status` dans cette
passe (`{"errors":{"access":"Your account is suspended..."}}`). Aucune
ligne du tableau n'est donc vérifiable pour API-Football — ceci reste un
constat sur l'état du compte, pas sur les capacités du plan Free
lui-même. Aucune action n'a été prise sur ce compte.

## Conclusion — A/B/C/D sur la suffisance du plan gratuit

**A. football-data.org Free suffit intégralement, pas besoin
d'API-Football pour le MVP.**
Vrai si le MVP Champions League n'a besoin que de : calendrier complet,
équipes/logos, dates, statuts, scores, classement. **Tout cela est
AVAILABLE et vérifié en conditions réelles.** C'est exactement ce
qu'il faut pour la chaîne `market_types → predictions → scoring` sur des
marchés simples (1N2, score exact, qualifié) : ces marchés se résolvent
avec le score final, pas avec le détail des buteurs/cartons.

**B. football-data.org Free suffit pour le socle, mais il manque des
données pour des fonctionnalités précises.**
Vrai si le produit veut aussi : afficher qui a marqué / les cartons
(scorers/events), les compositions (lineups), ou des statistiques de
match détaillées (possession, tirs...) — **ces trois éléments sont
confirmés UNAVAILABLE sur le plan Free football-data.org**, quel que
soit le plan testé. Dans ce cas, il faudrait soit un autre fournisseur
pour compléter seulement ces trois points, soit renoncer à ces
fonctionnalités pour le MVP.

**C. football-data.org Free est insuffisant même pour le socle.**
**Infirmé par les faits** : calendrier, équipes, scores, standings sont
tous vérifiés AVAILABLE avec des vraies données de la saison 2026-2027.

**D. Aucune conclusion possible sans test supplémentaire.**
Partiellement vrai sur deux points précis seulement : le comportement en
match live (`live`/`observed freshness`) n'a pas pu être testé faute de
match en cours ce jour-là, et API-Football reste totalement non
vérifiable tant que le compte est suspendu.

**Lecture factuelle recommandée** : **A pour le socle du MVP (calendrier/
scores/standings/équipes), B si le produit exige en plus buteurs/
cartons/compositions/stats.** Le point ouvert restant est le
comportement en direct (non testable aujourd'hui, faute de match en
cours) — testable gratuitement le jour d'un vrai match de Ligue des
Champions, sans dépense supplémentaire.

## Ce qui reste ouvert

1. **API-Football** reste non vérifié (compte suspendu) — reste une
   option si le produit a besoin de B (scorers/lineups/stats) et qu'un
   autre fournisseur gratuit ne les couvre pas.
2. **Comportement live** de football-data.org non testé faute de match
   en cours le jour du POC — à revérifier un jour de match réel, à coût
   nul (déjà dans le plan Free).
3. ~~Aucun développement Lot 2B...~~ Résolu : décision A actée le
   2026-09-25, Lot 2B démarre (voir ADR 0003).
