# Prompt initial — Claude Code (Sprint SILO 0 + SILO 1)

> À coller tel quel dans une session Claude Code, **dans un dépôt propre** dédié
> à John Commerce (pas dans le dépôt Canal Cup).

---

Nous allons construire une plateforme modulaire de Click & Collect et de
livraison pour une animalerie, appelée provisoirement « John Commerce ».

Le produit devra à terme supporter :
1. une boutique Animalia ;
2. plusieurs boutiques ;
3. plusieurs commerçants ;
4. un réseau de coursiers.

Mais pour ce premier sprint, tu dois **uniquement** construire le socle
technique et le silo Organisation/Utilisateurs.

## Contraintes techniques

- Next.js avec App Router — **vérifie la version stable actuelle** (et sa
  compatibilité avec Supabase) au moment de l'initialisation ; l'architecture
  impose App Router et TypeScript strict, **pas** une version figée par principe ;
- TypeScript strict ;
- PostgreSQL ;
- Supabase pour la base, l'authentification et le stockage ;
- Zod pour la validation ;
- Tailwind CSS ;
- Vitest pour les tests unitaires ;
- Playwright pour les tests fonctionnels critiques ;
- architecture modulaire par domaine ;
- aucune logique métier importante directement dans les composants React ;
- aucune dépendance directe des modules métier vers l'interface utilisateur ;
- migrations versionnées ;
- politiques RLS Supabase ;
- gestion explicite des erreurs ;
- journalisation des actions administratives sensibles.

## Architecture attendue

```
src/
  app/
    (public)/
    (auth)/
    (admin)/
    api/
  modules/
    organizations/
    stores/
    users/
    memberships/
    permissions/
  shared/
    auth/
    database/
    errors/
    validation/
    permissions/
    logging/
    ui/
  tests/
```

## Modèle fonctionnel initial

```
Organization : id, name, slug, status, createdAt, updatedAt
Store        : id, organizationId, name, slug, address, active, createdAt, updatedAt
UserProfile  : id, authUserId, firstName, lastName, phone, createdAt, updatedAt
Membership   : id, organizationId, userProfileId, role, active, createdAt, updatedAt
StoreMembership : id, storeId, membershipId
```

## Rôles initiaux

SUPER_ADMIN · ORGANIZATION_ADMIN · STORE_MANAGER · CATALOG_MANAGER · PREPARER ·
DRIVER · CUSTOMER_SUPPORT

## Règles

- SUPER_ADMIN voit toutes les organisations ;
- ORGANIZATION_ADMIN ne voit que son organisation ;
- STORE_MANAGER ne gère que ses boutiques ;
- aucun utilisateur ne doit pouvoir accéder aux données d'une autre organisation ;
- toutes les protections doivent exister côté serveur et en base, pas uniquement
  dans l'interface ;
- les rôles doivent être centralisés et ne jamais être comparés avec des chaînes
  dispersées dans le code.

## Écrans à construire

`/login` · `/admin` · `/admin/organization` · `/admin/stores` · `/admin/users` ·
`/unauthorized`

## Fonctionnalités

connexion ; déconnexion ; lecture de l'organisation courante ; création et
modification d'une boutique ; liste des utilisateurs ; création d'un utilisateur
ou préparation d'une invitation ; affectation d'un rôle ; rattachement d'un
utilisateur à une boutique ; protection des routes ; audit minimal des
changements de rôles.

## Données de démonstration

organisation : Animalia ; boutique : Animalia Nouméa ; un administrateur ; un
responsable de boutique ; un préparateur ; un chauffeur.

## Méthode d'exécution

1. inspecte le dépôt existant avant toute modification ;
2. si le dépôt est vide, initialise proprement le projet ;
3. produis un plan d'implémentation court ;
4. écris les migrations et le domaine avant les écrans ;
5. implémente les politiques de sécurité ;
6. ajoute les tests ;
7. exécute lint, typecheck, tests unitaires et tests fonctionnels ;
8. corrige réellement les erreurs ;
9. fournis un rapport final avec : fichiers créés ou modifiés ; modèle de
   données ; règles de sécurité ; tests exécutés ; limites restantes ;
   prochaines étapes.

## Ne développe pas encore

catalogue produit ; stock ; panier ; commande ; Click & Collect ; livraison ;
paiement ; marketplace ; coursiers à la demande.
