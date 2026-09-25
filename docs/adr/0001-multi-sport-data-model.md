# ADR 0001 — Modèle de données multi-sport (Sport/Competition/Season/Event)

Statut : **proposé**, non implémenté. Document de préparation P1 — la
première migration réelle de ce modèle arrive en P2, sur le catalogue
Champions League (pilote).

## Contexte

Canal Cup 2026 a un schéma pensé pour un seul événement (Coupe du Monde
2026) : `matches`, `predictions`, `teams`, `groups` sont tous implicitement
"foot, phase de poules + KO, un seul tournoi". CANAL Sports doit couvrir
plusieurs sports (foot, F1, rugby, MotoGP) et plusieurs compétitions par
sport, dans la durée (pas un seul événement figé dans le temps).

**Correction actée avec l'utilisateur avant ce document** : ne pas forcer
une structure identique entre sports. Un match de foot (2 équipes, score,
90 min) et une course de F1 (20+ pilotes, classement, temps au tour) n'ont
rien de commun dans le détail. Le modèle ne doit pas essayer de fabriquer
un schéma universel de "résultat" — il doit avoir un **socle commun réduit**
(identité, planning, statut) et laisser le détail sport-spécifique dans un
espace extensible (`jsonb`), pas dans des colonnes rigides partagées.

## Décision

### Hiérarchie commune (cœur, tables dédiées)

```
Sport
  └── Competition (ex: Champions League, MotoGP, Top 14)
        └── Season (ex: CL 2026-2027)
              └── Event (ex: PSG–Real Madrid, GP de Barcelone)
                    └── EventParticipant (ex: équipe, pilote, écurie)
```

- **Sport** : `id, slug (unique), name, icon`. Statique, peu de lignes
  (football, f1, rugby, motogp…).
- **Competition** : `id, sport_id (fk), slug, name, format` (`format` est
  une étiquette libre — "league", "knockout", "championship" — informative,
  pas structurante).
- **Season** : `id, competition_id (fk), label` (ex: "2026-2027"),
  `starts_at, ends_at`.
- **Event** : `id, season_id (fk), starts_at, venue, status
  (scheduled|live|finished|postponed|cancelled), external_ref jsonb`.
  `external_ref` porte les IDs des fournisseurs de données (API-Football,
  Ergast/F1, etc.) — voir "Multi-provider IDs" plus bas. **Pas de colonne
  `home_team_id`/`away_team_id`** au niveau `Event` : ce n'est vrai que
  pour le foot/rugby (2 camps), faux pour F1/MotoGP (N pilotes). Les
  participants vivent dans `EventParticipant`.
- **EventParticipant** : `id, event_id (fk), participant_type
  (team|individual), participant_id, role` (`role` est libre :
  "home"/"away" pour un sport à 2 camps, "grid_position" initial ou juste
  absent pour une course). Table de liaison — permet 2 comme 30
  participants au même `Event` sans changer de schéma.

### Ce qui N'EST PAS dans le socle commun

- **`result`** : `jsonb` sur `Event` (ou une table `EventResult` séparée
  1-1 avec `Event`, à trancher en P2 selon le volume de requêtes sur le
  résultat vs juste l'affichage). Contenu libre par sport :
  - Foot/rugby : `{ "home_score": 2, "away_score": 1, "periods": [...] }`
  - F1/MotoGP : `{ "classification": [{ "participant_id": ..., "position": 1, "time": "1:32:04.123" }, ...] }`
  - Pas de tentative d'unifier "score" — un classement de course n'est pas
    un score à deux nombres.
- **Statistiques détaillées, forme, historique** : hors du socle. Si un
  sport a besoin de tables dédiées riches (ex: temps au tour F1 par tour),
  ce sont des tables sport-spécifiques (`f1_lap_times`), pas des colonnes
  ajoutées au cœur commun. Le cœur reste stable même si un sport ajoute de
  la profondeur.

### Prédictions / marchés de pronostic

Autre endroit où "ne pas forcer une structure identique" s'applique : un
pronostic foot classique est "score exact ou 1N2", un pronostic F1 peut
être "top 3 dans l'ordre", un pronostic rugby peut inclure un écart de
points. Modèle retenu :

- **MarketType** : `id, sport_id (fk), slug (ex: "1n2", "exact_score",
  "podium_order"), name, payload_schema jsonb` — `payload_schema` décrit
  (au format libre, pas un validateur strict imposé ici) la forme attendue
  de `Prediction.payload` pour ce type de marché. Chaque sport définit ses
  propres `MarketType`, pas de liste fermée partagée.
- **Prediction** : `id, user_id (fk), event_id (fk), market_type_id (fk),
  payload jsonb, submitted_at, locked_at`. `payload` est libre selon
  `MarketType` — `{"result": "1"}` pour un 1N2, `{"home": 2, "away": 1}`
  pour un score exact, `{"order": ["p1","p3","p2"]}` pour un podium.
- **ScoringRule** : `id, market_type_id (fk), rule jsonb` (ou un
  identifiant de fonction de scoring versionnée) — permet à chaque
  `MarketType` d'avoir sa propre logique de points, sans qu'un moteur de
  scoring unique tente de couvrir tous les cas avec des `if sport ==`.

Ce découpage évite le piège identifié par l'utilisateur : ne pas répliquer
le biais Canal Cup ("un pronostic = un score à deux chiffres") dans le
nouveau modèle.

### Multi-provider IDs

Un `Event`/`Competition` peut être identifié différemment selon la source
de données utilisée pour l'alimenter (API-Football pour le foot,
potentiellement une autre API pour F1/rugby/MotoGP, jamais fixé à ce jour).
Décision : ne pas mettre `external_id` en colonne dédiée sur chaque table
(un seul fournisseur supposé) mais dans `external_ref jsonb`, ex :
`{"api_football": "12345", "sportradar": "abc-def"}`. Permet de changer ou
cumuler des fournisseurs par sport sans migration de schéma.

### Fuseaux horaires

`Event.starts_at` est stocké en `timestamptz` (UTC), comme le fait déjà
Canal Cup pour `matches.kickoff_at`. L'affichage utilisateur applique déjà
un fuseau par défaut (`DEFAULT_TZ`, actuellement Pacific/Nouméa — cohérent
avec `productConfig.defaultTimezone`, voir `lib/product/config.ts`). Pas de
changement de stratégie ici, juste une confirmation qu'elle tient pour
plusieurs sports/compétitions simultanées (un `Event` F1 en Europe et un
`Event` foot en Asie coexistent sans conflit, chacun avec son propre
`starts_at` UTC).

### JSONB vs tables dédiées — règle de décision

Pas une règle absolue, mais une heuristique pour P2+ :

- **JSONB** quand la donnée est : (a) lue en bloc (affichage), pas filtrée
  colonne par colonne en SQL ; (b) de forme variable selon le sport ; (c)
  peu volumineuse par ligne. → `result`, `Prediction.payload`.
- **Table dédiée** quand la donnée est : (a) interrogée/filtrée/agrégée en
  SQL (classements, historiques) ; (b) volumineuse ou répétée (ex: tour
  par tour en F1) ; (c) partagée entre plusieurs sports avec une vraie
  structure commune (ex: `EventParticipant`). → le socle commun ci-dessus.

## Alternatives rejetées

- **Schéma unique "match" générique avec colonnes nullable par sport**
  (ex: `score_home, score_away, lap_times, classification...` toutes sur
  une seule table `events`) — rejeté explicitement par l'utilisateur : ça
  reproduit le problème Canal Cup (schéma pensé pour un sport, étendu tant
  bien que mal) plutôt que de le résoudre.
- **EAV (Entity-Attribute-Value) générique pour tout**, y compris
  `Sport/Competition/Season/Event` — rejeté : ces objets ont une structure
  stable et interrogée (dates, statut, hiérarchie), un vrai schéma
  relationnel est plus simple et plus rapide qu'EAV pour ce niveau. Le
  JSONB est réservé au contenu réellement variable (résultat, payload de
  pronostic), pas à l'identité des objets.

## Conséquences

- P2 (pilote Champions League) implémente ce socle pour un seul sport
  (foot) — validation qu'il tient avant d'ajouter un deuxième sport
  structurellement différent (F1) en P3.
- Le moteur de scoring doit être écrit par `MarketType`, pas par sport
  générique — anticiper cette granularité dès la première implémentation
  évite une réécriture quand le deuxième sport arrive.
- Pas de migration de données Canal Cup vers ce modèle — nouveau schéma,
  nouvelles données (voir `docs/supabase-bootstrap-strategy.md`).
