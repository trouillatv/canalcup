# John Commerce — Documentation

> Plateforme modulaire de **Click & Collect** et de **livraison**, conçue pour
> démarrer avec une animalerie (**Animalia**) et pouvoir devenir, par étapes,
> multi-boutiques puis multi-commerçants, jusqu'à un réseau logistique local.

Ces documents décrivent **l'architecture cible** et le **plan d'exécution**.
Aucun code applicatif n'est encore écrit : c'est un plan, pas une implémentation.

> 📄 **Documentation de préparation uniquement.** Ce dossier ne contient que de
> la documentation destinée à préparer le produit. **L'implémentation ne doit
> pas se faire ici** : elle doit avoir lieu dans un **dépôt séparé et dédié**
> (`john-commerce`), où Claude Code inspectera un dépôt réellement vide et
> initialisera proprement la stack. Ces quatre fichiers pourront y être recopiés
> (par ex. sous `docs/product/`) pour servir de référence.

> ⚠️ Ce dossier vit dans le dépôt `canalcup`, qui héberge une application
> **différente et en production** (Canal Cup 2026). John Commerce n'a **rien**
> à voir avec Canal Cup : aucun fichier, historique, composant ou secret de
> Canal Cup ne doit être copié dans le dépôt d'implémentation, et réciproquement
> ce plan ne modifie aucun fichier de Canal Cup.

## Documents

| Fichier | Contenu |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Découpage complet en 16 silos, niveaux de produit, ordre de développement, discipline d'exécution. |
| [`SPRINT-0.md`](./SPRINT-0.md) | Périmètre fermé du premier sprint : SILO 0 (socle) + SILO 1 (organisations & utilisateurs). Modèle de données, sécurité, critères de sortie. |
| [`PROMPT-SPRINT-0.md`](./PROMPT-SPRINT-0.md) | Prompt prêt à coller pour lancer l'implémentation du sprint initial. |

## Principe directeur

On ne code **pas** immédiatement un « Grab calédonien » complet. On découpe le
produit en **silos fonctionnels autonomes**, chacun avec son contrat, ses
données et ses écrans, reposant sur un **socle commun**.

Le premier produit réellement exploitable :

> Une plateforme Click & Collect et livraison pour Animalia, pensée dès le
> départ pour devenir multi-boutiques et multi-commerçants.

## Règle d'or

> On ne demande jamais « fais toute la plateforme ». On donne **un silo, un
> périmètre fermé, des exclusions et des critères de sortie.**

Point de départ : **SILO 0 + SILO 1**. Le catalogue ne vient qu'après validation.
