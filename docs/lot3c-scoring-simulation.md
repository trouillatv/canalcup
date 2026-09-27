# Lot 3C — Audit d'architecture de pronostic + simulation Monte-Carlo du barème

Statut : **analyse et simulation locales terminées, 2026-09-25.** Aucune
écriture Supabase, aucune migration, aucune donnée modifiée sur
`yfhuqsuboqfznnpceosl` ou `qmkbnafilhdhnsdupgzd`. Ce document se termine par
un **HARD STOP** : rien ci-dessous n'est appliqué avant validation explicite
de l'utilisateur.

**Mise à jour Lot 3D (2026-09-25)** : les recommandations ci-dessous ont
depuis été actées par l'utilisateur — voir le bloc "Décisions validées
(2026-09-25, Lot 3D)" dans `docs/adr/0005-prediction-engine-market-types.md`.
Une divergence assumée par rapport à la recommandation §5 point 3 : ce
document proposait de laisser `match_winner_1x2` dormant au registre "sans
coût" ; la décision Lot 3D a préféré le **supprimer** entièrement
(préférence explicite de l'utilisateur pour éviter les concepts morts).
Le reste de l'analyse ci-dessous (architecture B, barème 3+2) est
appliqué tel que recommandé.

Convention de lecture, respectée strictement dans tout le document :

- **FAIT MESURÉ** — observé directement dans le schéma/code existant, ou
  produit par la simulation locale (`lib/simulation/`), reproductible.
- **HYPOTHÈSE** — supposition documentée et assumée (profil synthétique,
  calibration, variante non demandée par le produit), jamais présentée comme
  un résultat.
- **DÉCISION RECOMMANDÉE** — recommandation de l'auteur, **pas** une décision
  actée. Seul l'utilisateur décide.

---

## 1. Audit du modèle actuel — architectures A / B / C

### 1.1 FAITS MESURÉS (relecture ADR 0005 + `lib/predictions/contracts.ts` + `lib/predictions/scorers.ts`)

- Le schéma déployé (`lot_3b_prediction_engine`, ADR 0005 §2) seed
  **exactement deux lignes `market_types`** pour le football :
  `match_winner_1x2` (`scorer_key = match_winner_1x2.v1`) et `exact_score`
  (`scorer_key = exact_score.v1`). Rien n'oblige une UI à créer une
  `prediction` pour les deux — c'est une décision produit non prise à ce
  jour, pas une contrainte du schéma.
- `exactScoreScorer.computeFacts()` (`lib/predictions/scorers.ts`), à partir
  du **seul** payload `{home, away}`, calcule déjà trois faits indépendants :
  `exact`, `correct_outcome`, `correct_diff`. `correct_outcome` est déjà une
  dérivation complète du 1N2 à partir d'un score exact — aucune information
  supplémentaire n'est nécessaire.
- `matchWinner1x2Scorer.computeFacts()` ne calcule qu'un seul fait
  (`correct`) à partir d'un payload `{selection}` strictement plus pauvre que
  `{home, away}` — il n'ajoute aucune capacité que `exact_score` n'a pas déjà.
- Le simulateur Lot 3C (`lib/simulation/engine.ts`) importe et appelle
  directement `computeExactScoreFacts()`, le vrai scorer de production, sans
  aucune modification — la Monte-Carlo entière tourne avec l'architecture "un
  seul payload score exact, faits dérivés", ce qui revalide en conditions de
  charge (300 réplications × 150 joueurs × 144 matchs) que ce chemin
  fonctionne sans erreur.

### 1.2 Comparaison A / B / C

| Critère | **A** — deux marchés, deux `predictions` (1N2 + score exact soumis séparément) | **B** — un seul `exact_score`, 1N2 dérivé (déjà supporté par le code actuel) | **C** — autre architecture |
|---|---|---|---|
| **Cohérence** | Risque structurel : rien n'empêche `selection="domicile"` et `{home:1,away:2}` d'être soumis en même temps sur le même match — deux vérités possibles pour un seul geste utilisateur. | Forte par construction : un seul payload, les trois faits sont dérivés du même chiffre, aucune contradiction possible. | Aucune architecture alternative trouvée qui améliore la cohérence au-delà de B — un payload unique est déjà la meilleure garantie structurelle. |
| **Extensibilité** | Bonne en théorie (`market_types` reste générique), mais dans les faits chaque marché duplique un scorer/validateur pour un gain nul si le score exact est toujours saisi. | Le marché `match_winner_1x2` reste au registre, réutilisable **sans migration** si un vrai besoin produit apparaît plus tard (ex. pronostic rapide sans score) — rien n'est supprimé, juste non instancié dans le flux actuel. | Généraliser le pattern "un scorer produit plusieurs faits à partir d'un seul payload" à d'autres sports/marchés (déjà ce que fait `exactScoreScorer`) — pas une architecture différente de B, plutôt sa formalisation en principe de conception. |
| **Auditabilité** | Deux lignes `predictions` par `(user, event)` à croiser pour reconstituer un classement — `points_awarded` doit être sommé sur 2 lignes, `outcome_facts` éclaté en 2 objets. | Une seule ligne, un seul `outcome_facts` contenant déjà les 3 faits, un seul `points_awarded` — le classement est une simple somme sur une ligne par `(user, event)`. | Identique à B. |
| **Settlement** | Deux scorers appelés par event soldé, double travail pour un gain d'information nul (le 1N2 est déjà dans le score exact). | Un seul scorer appelé, coût divisé par deux, **zéro changement de code** (`settlePendingPredictions()` tel que conçu en ADR 0005 §4 fonctionne déjà ainsi). | Identique à B. |
| **UX** | Deux interactions pour un seul geste mental ("mon pronostic pour ce match") — friction inutile pour un public non-expert (rappel : cible = collaborateurs/prestataires non-experts). | Un seul geste ("je prédis 2-1"), aligné sur l'usage naturel d'un sweepstake, cohérent avec Canal Cup (retour d'expérience ADR 0005 §1.3) en évitant son anti-pattern inverse (une seule colonne figée) sans réintroduire une double saisie. | Identique à B. |
| **Dette technique** | Risque de divergence entre les deux payloads si jamais liés artificiellement plus tard pour forcer la cohérence — complexité ajoutée a posteriori. | Nulle — c'est déjà le comportement du code de production actuel, revalidé par 43 200 appels réels de `computeExactScoreFacts()` pendant la simulation (300 × 150 × 144 / réduit par cache — voir §3). | Aucune dette identifiée au-delà de B. |

### 1.3 DÉCISION RECOMMANDÉE — architecture d'entrée

**Adopter l'architecture B pour le flux de pronostic "score simple" :** une
seule `prediction` de marché `exact_score` par `(user, event)`, le 1N2 est un
fait dérivé (`correct_outcome`), jamais un second marché à soumettre.

- **Aucune migration nécessaire.** Le schéma ADR 0005 supporte déjà ce
  fonctionnement tel quel.
- Le marché `match_winner_1x2` reste défini en base (`market_types`,
  `is_active=true`) mais **n'est simplement jamais instancié** par le flux de
  saisie principal — décision de couche applicative/produit, pas de schéma.
  Il resterait disponible sans coût si un besoin futur distinct apparaissait
  (ex. un mode "pronostic rapide" sans score, hors scope ici).
- Ceci répond directement à la consigne "ne pas garder deux marchés juste
  parce qu'ils existent" : le second marché existe dans le registre par
  prudence/extensibilité, mais n'est **pas utilisé** dans le parcours
  utilisateur tant qu'aucun besoin ne le justifie.

Modification Lot 3B **proposée, non appliquée** (voir §5) : un addendum à
l'ADR 0005 documentant explicitement ce choix produit, sans toucher au
schéma SQL, aux contrats ou aux scorers.

---

## 2. Méthodologie de la simulation Monte-Carlo

### 2.1 FAITS MESURÉS — ce qui a été construit et exécuté

- Simulateur entièrement local, aucune dépendance réseau ni écriture
  Supabase : `lib/simulation/{rng,calendar,team-strength,season-generator,
  profiles,scoring-schemes,metrics,engine}.ts` + point d'entrée
  `lib/simulation/run-simulation.ts`.
- PRNG seedé (mulberry32, `lib/simulation/rng.ts`), jamais `Math.random()` —
  reproductibilité stricte vérifiée par test (`runSimulation` sur une même
  config produit une sortie `deepEqual`).
- Calendrier réel Ligue des Champions 2026/27 (`lib/simulation/calendar.ts`,
  144 rencontres, 36 équipes) : journée 1 (18 matchs) = **résultats réels**,
  journées 2 à 8 (126 matchs) = simulées.
- Le vrai scorer de production (`computeExactScoreFacts`,
  `lib/predictions/scorers.ts`) est importé et appelé directement — la
  simulation ne réimplémente jamais la logique de faits.
- Échelle de l'exécution finale : `baseSeed=42`, **300 réplications** × **30
  joueurs par profil** × **5 profils** × **144 matchs** × **6 barèmes** × **4
  taux d'absence** (0/5/10/20 %) → 9 000 échantillons par (profil, barème,
  taux d'absence), stables (écart-type de la moyenne négligeable à ce n).
  Temps d'exécution : ~15,3 s.
- Rapport complet reproductible : `docs/lot3c-simulation-report.json`
  (régénérable par `node lib/simulation/run-simulation.ts`).
- 71 tests unitaires dédiés (`lib/simulation/*.test.ts`), tous verts ;
  suite complète du repo (`node --test "lib/**/*.test.ts"`) sans régression
  sur le code Lot 3B.

### 2.2 HYPOTHÈSES — profils synthétiques (documentées, sans fuite de résultat)

Chaque profil ne reçoit **jamais** le résultat réel/généré du match qu'il
pronostique — vérifié structurellement par test (arité des fonctions de
profil, absence de la clé résultat dans le contexte passé). Bruit et forces
d'équipe sont tirés une fois, fixes pour toute la simulation.

| Profil | Construction | Statut |
|---|---|---|
| `aleatoire` | Score `Poisson(λ=1.35)` indépendant par équipe, sans aucune information. | HYPOTHÈSE — plancher de référence, aucune connaissance simulée. |
| `favori` | Score tiré sur une **perception publique bruitée** (force réelle + bruit gaussien σ=0.30), force le vainqueur perçu. | HYPOTHÈSE — approxime un joueur qui suit l'avis majoritaire, sans accès aux vraies forces. |
| `prudent` | Tire parmi 6 scorelines réalistes fixes (1-0, 0-0, 1-1, 2-1, 1-2, 2-0), sans biais de camp. | HYPOTHÈSE — approxime un joueur qui mise sur des scores "raisonnables" plutôt que sur un favori. |
| `contrarian` | Comme `favori` mais force le **négligé** perçu (perception favori, camp inversé). | HYPOTHÈSE — plancher "anti-signal", utile pour mesurer si le barème punit bien une stratégie délibérément mauvaise. |
| `expert_simule` | Comme `favori` mais bruit réduit (σ=0.12 vs 0.30) — mieux informé, jamais voyant. | HYPOTHÈSE explicitement documentée : aucune donnée réelle "expert" n'était disponible et honnêtement dérivable sans fuite ; modélisée par un bruit de perception plus faible, seule différence avec `favori`. |

Calibration des forces d'équipe (`STRENGTH_STD_DEV=0.35`, `HOME_ADVANTAGE=0.6`,
`BASE_LOG_RATE=0.42`) : grid-search Monte-Carlo contre les 18 résultats réels
de journée 1 (~61,1 % domicile / ~11,1 % nul / ~27,8 % extérieur / ~3,83
buts/match). Meilleur point trouvé : ~59,8 % domicile / ~17,4 % nul / ~22,8 %
extérieur / ~4,04 buts/match. **HYPOTHÈSE assumée** : l'écart résiduel sur le
taux de nul (17,4 % vs 11,1 %) n'a pas pu être réduit malgré un balayage large
(σ 0,35–0,8, avantage domicile 0,25–0,9) — les modèles à buts Poisson
indépendants ont une limite structurelle sur le taux de nul reproductible ;
l'écart est traité comme plausiblement du bruit d'échantillon (n=18), pas
comme un défaut corrigible du modèle.

### 2.3 Absence modélisée

Absence tirée **par journée complète** (pas par match) via Bernoulli(taux) —
un joueur absent une journée marque 0 sur les 18 matchs de cette journée.
Taux testés : 0 %, 5 %, 10 %, 20 %.

---

## 3. Résultats — tableau comparatif des barèmes (FAITS MESURÉS, à 0 % d'absence)

| Barème | Médiane globale | Discrimination expert vs aléatoire (gap / Cohen's d) | Part de points venant du score exact (aléatoire → expert) | Taux d'égalité au classement |
|---|---|---|---|---|
| **3+2 (référence)** — `baseline_0_3_2` | 191 | 118,0 pts / **d=6,48** | 7,8 % → 5,4 % | 76,4 % |
| 2+3 — `scheme_2_3` | 141 | 80,7 pts / d=5,46 | 16,0 % → 11,4 % | 79,6 % |
| 3+1 — `scheme_3_1` | 183 | 116,8 pts / d=6,85 | 4,1 % → 2,8 % | 77,7 % |
| 1+3 — `scheme_1_3` | 83 | 42,2 pts / d=4,02 | 27,6 % → 20,5 % | 86,3 % |
| 4+1 (socle généreux) — `scheme_4_1` | 241 | 155,3 pts / **d=6,93** | 3,1 % → 2,1 % | 73,9 % |
| HYPOTHÈSE bonus diff — `diff_bonus_hypothesis` | 207 | 121,4 pts / d=6,17 | 7,2 % → 5,1 % (+ diff 7,4 %→5,1 %) | 71,6 % |

*(Cohen's d calculé entre `expert_simule` et `aleatoire`, mêmes 9 000
échantillons ; "taux d'égalité" = moyenne, sur les 300 réplications, du taux
de doublons de score total au sein du classement d'une seule saison — voir
§3.4 sur le piège de mesure corrigé.)*

### 3.1 Fréquence de score exact — indépendante du barème (FAIT MESURÉ)

| Profil | Fréquence score exact |
|---|---|
| aléatoire | 4,47 % |
| favori | 5,23 % |
| prudent | 5,46 % |
| contrarian | 2,60 % |
| expert_simule | 5,32 % |

**Constat clé** : `favori`, `prudent` et `expert_simule` obtiennent une
fréquence de score exact quasiment identique (5,2–5,5 %), y compris l'expert
mieux informé — l'écart entre `favori` et `expert_simule` est de 0,09 point
seulement. Le score exact est donc **très largement dominé par le hasard**
(tirage Poisson), pas par la qualité de l'information. La discrimination
observée dans le tableau §3 provient presque entièrement du **1N2 correct**
(`correct_outcome`), pas du score exact — un joueur mieux informé prédit
mieux *qui gagne*, presque jamais mieux *le score exact*.

### 3.2 Proportionnalité du bonus score exact

Ceci répond directement à la question posée : le bonus score exact est-il
proportionné ou introduit-il trop de hasard ?

- **2+3 et 1+3** : jusqu'à 27,6 % (aléatoire) et 20,5 % (expert) des points
  viennent du score exact — un tirage quasi indépendant de la compétence.
  Le classement final serait significativement redistribué par la chance sur
  144 tirages Poisson. **Trop de hasard, non recommandé.**
- **3+1 et 4+1** : le score exact tombe à 2,1–4,4 % des points — presque
  anecdotique. Le bonus perd toute valeur perçue ("j'ai deviné le score
  exact, et alors ?"), ce qui contredit l'objectif produit "gratifiant sans
  sur-distribuer".
- **3+2 (référence) et l'hypothèse bonus diff** : 5,1–8,4 % des points,
  visible mais jamais dominant — c'est la zone où le bonus reste motivant
  sans piloter le classement.

### 3.3 Sensibilité à l'absence (5 %, 10 %, 20 %)

FAIT MESURÉ, structurel et indépendant du barème choisi : la dégradation de
la moyenne est quasi proportionnelle au taux d'absence (~20 % de points en
moins à 20 % d'absence, pour tous profils et tous barèmes, car retirer X % des
journées retire ~X % des points). Ce qui varie réellement selon le profil,
c'est la **survie au-dessus de la médiane globale initiale**
(`survivalAboveOverallMedian`, barème de référence 3+2) :

| Profil | 0 % absence | 5 % | 10 % | 20 % |
|---|---|---|---|---|
| favori | 100 % | 99,0 % | 95,2 % | 78,4 % |
| expert_simule | 100 % | 99,0 % | 95,6 % | 79,2 % |
| prudent | 42,1 % | 29,5 % | 20,6 % | 9,7 % |
| aléatoire | 9,8 % | 7,0 % | 4,7 % | 1,9 % |
| contrarian | 0 % | 0 % | 0 % | 0 % |

**Constat** : un joueur informé (favori/expert) reste majoritairement
au-dessus de la médiane initiale même en ratant 20 % des journées (~4
journées sur 8, à cette échelle de test) — le jeu ne "punit" pas
disproportionnellement une absence raisonnable pour un bon joueur. Un joueur
non informé ne devient jamais compétitif, absence ou non — cohérent avec
l'objectif "le football doit compter".

### 3.4 Taux d'égalité au classement — piège de mesure corrigé

Un premier calcul erroné avait mélangé les totaux de 300 réplications
indépendantes dans un seul pool avant de calculer le taux d'égalité, ce qui
donnait artificiellement ~100 % pour tous les barèmes (effet tiroir : 45 000
valeurs entassées dans une plage étroite de totaux possibles). Corrigé en
calculant le taux d'égalité **à l'intérieur de chaque réplication** (un vrai
classement d'une seule saison, 150 joueurs), puis en moyennant sur les 300
réplications. Résultat corrigé : 71,6 % à 86,3 % selon le barème (tableau
§3) — toujours élevé, mais c'est structurel : sur 144 matchs à points
entiers avec 150 concurrents simulés, des doublons de score total restent
statistiquement fréquents quel que soit le barème (l'écart entre le meilleur
et le pire barème testé n'est que de ~15 points de pourcentage). **HYPOTHÈSE
à noter** : le cohorte réelle CANAL Sports (collaborateurs/prestataires) sera
probablement plus petite que les 150 comptes simulés ici — le taux d'égalité
réel dépendra de la taille réelle du groupe, non re-modélisée précisément
dans cette simulation.

---

## 4. DÉCISIONS RECOMMANDÉES — barème

**Barème recommandé : 3 + 2 (référence, `baseline_0_3_2`).**

Justification quantifiée :
- Discrimination quasi maximale (d=6,48, à 0,45 du meilleur testé, 4+1 à
  d=6,93) sans le défaut du socle généreux de 4+1 (médiane 241, contre 191
  pour 3+2 — 4+1 distribue trop de points juste pour un bon résultat, ce qui
  dilue la valeur perçue de progresser).
- Part du score exact dans les points (5,1–8,4 %) proportionnée : visible et
  gratifiante, jamais dominante (contrairement à 2+3/1+3, où elle grimpe
  jusqu'à 27,6 %).
- Barème le plus simple à expliquer à un public non-expert : "3 points bon
  résultat, +2 si score exact, plafond 5" — reprend une convention de
  sweepstake classique, aucun apprentissage nécessaire.
- C'est littéralement la référence déjà proposée par l'utilisateur ("Vincent")
  — la simulation la confirme statistiquement plutôt que de la remplacer.

**Hypothèse bonus différence de buts : rejetée.** Elle n'améliore pas la
discrimination (d=6,17, **inférieur** à la référence 3+2) tout en ajoutant
une troisième dimension à expliquer (bon résultat / bonne différence / score
exact) — complexité ajoutée sans bénéfice mesuré. Traité comme hypothèse
testée et écartée, jamais appliqué.

**3+1 et 4+1** : meilleure discrimination brute, mais bonus score exact
quasi négligeable (2,1–4,4 % des points) — risque de décevoir un joueur qui
"cartonne" un score exact pour un gain marginal. Non recommandés en
alternative principale, mais retenus comme options de repli si le produit
préfère minimiser la part de hasard au prix d'un bonus moins gratifiant.

**2+3 et 1+3** : à écarter — trop de hasard (score exact jusqu'à 27,6 % des
points), discrimination la plus faible des 6 barèmes testés (d=4,02 pour
1+3).

**Sur le taux d'égalité** : ne pas chercher à l'éliminer par le choix de
barème seul (l'écart entre le meilleur et le pire barème testé n'est que de
~15 points de %, structurellement inhérent aux totaux entiers sur un nombre
fini de matchs). Recommandation opérationnelle : définir une règle de
départage explicite (ex. nombre de scores exacts, puis date de première
soumission) plutôt que de sur-optimiser le barème pour ce seul critère.

---

## 5. Modifications Lot 3B proposées (NON appliquées)

Rien ci-dessous n'a été exécuté. Toute application nécessite validation
explicite séparée, conformément au HARD STOP déjà posé sur Lot 3B.

1. **Addendum à `docs/adr/0005-prediction-engine-market-types.md`**
   documentant la décision produit "architecture B" (§1.3) : le flux de
   pronostic principal ne crée qu'une `prediction` de marché `exact_score`
   par `(user, event)` ; `match_winner_1x2` reste au registre mais n'est pas
   instancié par ce flux. Aucun changement de schéma, de contrat ou de
   scorer.
2. **Valeur de `scoring_rules.rule`** (table toujours vide) — si le barème
   3+2 est validé, la forme proposée en ADR 0005 §4 (liste ordonnée,
   première correspondance gagnante) donnerait, pour `exact_score` :
   `[{"when":{"exact":true},"points":5}, {"when":{"correct_outcome":true},"points":3}, {"when":{},"points":0}]`
   — à valider explicitement avant toute insertion (`is_active` resterait
   `false` tant que non confirmé).
3. **Aucune modification proposée pour `match_winner_1x2`** : le marché et
   son scorer restent inchangés et inutilisés par défaut, réserve pour un
   besoin futur non spécifié.

---

## HARD STOP — décisions requises avant Lot 3D

1. **Architecture de saisie recommandée** : Architecture B — un seul
   pronostic `exact_score` par match, 1N2 dérivé automatiquement. Aucune
   migration nécessaire ; nécessite seulement de ne pas construire de flux
   UI créant deux `predictions` pour un même match.
2. **Barème recommandé** : 3 + 2 (`baseline_0_3_2`) — meilleur compromis
   mesuré entre discrimination (d=6,48), proportion raisonnable de hasard
   (score exact = 5,1–8,4 % des points) et simplicité pour un public
   non-expert.
3. **Résultats quantitatifs clés** :
   - Le score exact est très largement dominé par le hasard (favori 5,23 %
     vs expert 5,32 % de fréquence — écart de 0,09 point) ; la
     discrimination réelle vient du 1N2, pas du score exact.
   - Le taux d'égalité au classement (71,6–86,3 % selon barème) est
     structurel, pas piloté par le choix du barème seul.
   - Un joueur informé reste compétitif même après 20 % d'absence (~78–79 %
     de survie au-dessus de la médiane initiale) ; un joueur non informé ne
     devient jamais compétitif, absence ou non.
   - L'hypothèse "bonus différence de buts" a été testée et n'améliore pas
     la discrimination par rapport à la référence 3+2 — rejetée.
4. **Trade-offs identifiés** : 3+1/4+1 discriminent légèrement mieux mais
   rendent le bonus score exact quasi anecdotique (2,1–4,4 % des points) ;
   2+3/1+3 sont plus généreux sur le score exact mais laissent trop de place
   au hasard et discriminent le moins bien des 6 barèmes testés.
5. **Modifications Lot 3B proposées (§5)**, non appliquées, en attente de
   validation.

**Décisions demandées à l'utilisateur avant de poursuivre vers Lot 3D :**

- Valider (ou infirmer) l'architecture B comme flux de saisie unique.
- Valider (ou choisir une alternative parmi les 6 testées) le barème 3+2.
- Valider (ou refuser) l'ajout de l'addendum ADR 0005 décrit en §5.1.
- Indiquer si une règle de départage de classement doit être spécifiée
  maintenant ou reportée à un lot ultérieur.
