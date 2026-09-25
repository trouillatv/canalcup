# ADR 0001 — Modèle de données multi-sport (Sport/Competition/Season/Event)

Statut : **proposé, corrigé en P2 avant implémentation**. Voir
"Addendum P2" en fin de document — le socle initial (P1) a été confronté
au cas réel Ligue des Champions et a révélé trois angles morts (stage/
round data-driven, deux manches, idempotence de l'ingestion) corrigés
ci-dessous avant toute migration SQL.

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
  (scheduled|live|finished|postponed|cancelled), stage, stage_order,
  matchday, leg, source, external_id, last_synced_at, result jsonb,
  metadata jsonb`. Les quatre colonnes `stage/stage_order/matchday/leg`
  et `source/external_id` sont des ajouts **P2** — voir "Addendum P2" plus
  bas pour leur justification (elles n'existaient pas dans la version P1
  de cet ADR). **Pas de colonne `home_team_id`/`away_team_id`** au niveau
  `Event` : ce n'est vrai que pour le foot/rugby (2 camps), faux pour F1/
  MotoGP (N pilotes). Les participants vivent dans `EventParticipant`.
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
**Révisé en P2** (voir Addendum P2, point 3) : `source`/`external_id`
deviennent des colonnes dédiées avec contrainte d'unicité par table —
nécessaire pour un upsert idempotent, ce que `jsonb` seul ne garantit pas.
`metadata jsonb` reste le mécanisme pour des identifiants secondaires
(deuxième provider, IDs additionnels) sans devenir la clé d'upsert.

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

## Addendum P2 — confrontation au cas réel Ligue des Champions

Le socle P1 ci-dessus a été relu avant migration, en le confrontant au
format réel de la Ligue des Champions 2024+ ("Swiss model") : une phase de
championnat unique à 36 équipes (8 matchs chacune, un classement général,
pas de "groupes"), puis des barrages de qualification, puis 8es, quarts,
demies et une finale à match unique sur terrain neutre — les tours à
partir des 8es se jouent en **deux manches** (aller/retour, score cumulé).
Trois manques identifiés dans la version P1, corrigés ici :

### 1. Stage/round absent du socle Event

La version P1 de cet ADR ne portait aucune notion de phase/journée sur
`Event`. Or "quelle phase, quelle journée" est une donnée structurante
pour l'affichage Programme (section 9/14 du prompt P2) et ne doit
**surtout pas** être codée en dur (`if phase === "Groupe"` — c'est
exactement le bricolage Coupe du Monde à ne pas reproduire, cf.
`groups-2026.ts` dans Canal Cup). Décision : 4 colonnes simples sur
`Event`, toutes optionnelles/data-driven, pas de table
`competition_stages` séparée (heuristique retenue : la donnée est
publiée telle quelle par le provider — `f.league.round` chez API-Football
— pas besoin d'une table de référence tant qu'aucun tri/filtre complexe
ne l'exige) :

- `stage text` — libellé publié par le provider, affiché tel quel
  ("League phase", "Round of 16", "Quarter-finals"…). Aucune valeur
  n'est une constante du code.
- `stage_order int nullable` — ordre d'affichage au sein de la saison,
  calculé à l'ingestion (position dans la liste des stages rencontrés),
  pas une signification métier fixe partagée entre compétitions.
- `matchday int nullable` — numéro de journée pour les phases qui en ont
  un (journées 1 à 8 en phase de championnat) ; `null` pour les tours à
  élimination directe.
- `leg int nullable` — 1 ou 2 pour un match aller/retour ; `null` pour un
  match unique (phase de championnat, finale).

Si un sport/compétition futur a besoin de plus (ex: poules lettrées),
cela reste modélisable avec `stage` en texte libre — pas de migration de
schéma nécessaire pour ce cas.

### 2. Agrégat aller/retour non modélisé

Un tour à deux manches (ex: 8e de finale PSG-Liverpool aller + retour)
est **deux lignes `Event` distinctes** liées par `leg` (1/2), pas une
entité "Tie" séparée — décision volontairement minimale pour P2 : calculer
le score cumulé est un besoin d'affichage (P3, Event Center), pas un
besoin de schéma. Pour relier les deux manches sans nouvelle table,
`metadata jsonb` sur `Event` porte une clé libre `tie_ref` (ex: l'ID de
tour côté provider) quand le provider la fournit. Si cette approche
s'avère insuffisante en pratique (ex: agrégat demandé dès P2 dans l'Event
Center), un couple `(competition_id, season_id, stage, tie_ref)` suffit à
regrouper sans table dédiée — pas de sur-ingénierie avant besoin réel.

### 3. Idempotence de l'ingestion sous-spécifiée

La version P1 ne portait `external_ref` qu'en `jsonb` sur `Event`
uniquement, sans contrainte d'unicité — insuffisant pour un `UPSERT`
fiable (section 8 du prompt P2 : "relancer la synchro N fois ne doit pas
créer N événements"). Correction : `source text` + `external_id text`
deviennent des **colonnes dédiées** (pas seulement dans `jsonb`) sur
chaque table alimentée par un provider (`Competition`, `Season`, `Event`,
`Participant`), avec une contrainte `UNIQUE (source, external_id)` par
table — c'est ce qui permet `ON CONFLICT (source, external_id) DO UPDATE`
à l'ingestion. `external_ref jsonb`/`metadata jsonb` reste disponible pour
des identifiants secondaires (ex: un deuxième provider plus tard) sans
devenir la clé d'upsert principale — pas de sur-abstraction en table
`provider_mappings` générique tant qu'un seul provider par entité est actif
(cf. section 6 du prompt P2 : ne pas sur-abstraire avant besoin réel).
`last_synced_at timestamptz` accompagne `Event` pour l'observabilité de
synchro (section 17).

### 4. Diffusion (broadcast) absente du socle P1

Non couverte du tout en P1. Ajout d'une table séparée (pas du `jsonb` sur
`Event`, car c'est 0-à-N lignes par événement — plusieurs territoires/
chaînes possibles) :

`event_broadcasts` : `id, event_id (fk), channel text, territory text,
starts_at timestamptz nullable, source text, verified_at timestamptz
nullable`. Aucune valeur "CANAL+" par défaut — une ligne n'existe que si
une source l'a confirmée (voir section 7/15 du prompt P2 : aucune donnée
de diffusion fabriquée). `verified_at` distingue une donnée fraîchement
vérifiée d'une donnée ancienne qui pourrait avoir changé.

### Ce qui reste inchangé après confrontation au cas réel

La hiérarchie Sport→Competition→Season→Event→EventParticipant, le choix
`result jsonb` (un score foot à 2 nombres suffit toujours pour ce socle),
le modèle `MarketType`/`Prediction`/`ScoringRule` (non touché par P2, sujet
à P3) et la stratégie JSONB-vs-tables-dédiées tiennent tels quels face au
cas réel Ligue des Champions — aucune remise en cause structurelle
majeure, seulement des colonnes manquantes.

## Conséquences

- P2 (pilote Champions League) implémente ce socle pour un seul sport
  (foot) — validation qu'il tient avant d'ajouter un deuxième sport
  structurellement différent (F1) en P3.
- Le moteur de scoring doit être écrit par `MarketType`, pas par sport
  générique — anticiper cette granularité dès la première implémentation
  évite une réécriture quand le deuxième sport arrive.
- Pas de migration de données Canal Cup vers ce modèle — nouveau schéma,
  nouvelles données (voir `docs/supabase-bootstrap-strategy.md`).
- `stage/stage_order/matchday/leg` et `source/external_id` (Addendum P2)
  sont désormais actés pour la migration P2 — voir le schéma détaillé
  dans le rapport P2 (à produire après validation des préconditions
  repo/Supabase).
